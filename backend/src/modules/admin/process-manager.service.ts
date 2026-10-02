import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 进程管理器: 控制 4 个 Node 服务(api/web/admin/proxy)的启停/重启/状态
 * - 启动: spawn detached + windowsHide, pid 写 .pids/<name>.pid, 日志 → logs/<name>.log
 * - 停止: 读 pid → taskkill /F /PID; pid 缺失按端口 netstat 兜底
 * - 后端自身(api)自停/自启: 用 detached 延迟进程(杀/起)避免悬挂
 * - 与 start-all.bat 共存: 端口已占用则显示 running 不重复 spawn
 */

type ProcName = 'api' | 'web' | 'admin' | 'proxy';

interface ProcDef {
  name: ProcName;
  port: number;
  cwd: string;
  args: string[];
  /** node 命令前缀(可含参数如 next start 走 bin) */
  bin?: string;
}

const ROOT = path.resolve(__dirname, '../../../..'); // backend/dist/modules/admin → 项目根(4 级)
const PID_DIR = path.join(ROOT, '.pids');
const LOG_DIR = path.join(ROOT, 'logs');

const PROC_DEFS: ProcDef[] = [
  {
    name: 'api',
    port: 3001,
    cwd: path.join(ROOT, 'backend'),
    args: ['dist/main.js'],
    bin: 'node',
  },
  {
    name: 'web',
    port: 3000,
    cwd: path.join(ROOT, 'frontend'),
    args: ['node_modules/next/dist/bin/next', 'start', '-p', '3000'],
    bin: 'node',
  },
  {
    name: 'admin',
    port: 3002,
    cwd: path.join(ROOT, 'frontend'),
    args: ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3002'],
    bin: 'node',
  },
  {
    name: 'proxy',
    port: 8888,
    cwd: ROOT,
    args: ['proxy.js'],
    bin: 'node',
  },
];

function resolveProc(name: string): ProcDef {
  const def = PROC_DEFS.find((d) => d.name === name);
  if (!def) throw new BadRequestException(`未知进程: ${name}(可选 ${PROC_DEFS.map((d) => d.name).join('/')})`);
  return def;
}

/** 探测端口是否被监听(800ms 超时) */
function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.setTimeout(800);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => resolve(false));
  });
}

/** 按端口找 PID(netstat -ano 兜底) */
function findPidByPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`netstat -ano -p tcp | findstr :${port}`, (err: unknown, stdout: string) => {
      if (err || !stdout) return resolve(null);
      const m = stdout.match(/LISTENING\s+(\d+)/);
      resolve(m ? Number(m[1]) : null);
    });
  });
}

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger('ProcessManager');

  constructor() {
    fs.mkdirSync(PID_DIR, { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  /** 全部进程状态 */
  async status() {
    const list: Array<{ name: string; port: number; running: boolean; pid: number | null }> = [];
    for (const def of PROC_DEFS) {
      const running = await probePort(def.port);
      const pid = running
        ? ((await this.readPid(def.name)) ?? (await findPidByPort(def.port)))
        : null;
      list.push({
        name: def.name,
        port: def.port,
        running,
        pid,
      });
    }
    return { list };
  }

  /** 启动进程(端口已占用则不重复启动) */
  async start(name: string) {
    const def = resolveProc(name);
    const running = await probePort(def.port);
    if (running) return { name, started: false, reason: 'already-running' };

    const logFile = path.join(LOG_DIR, `${def.name}.log`);
    const fd = fs.openSync(logFile, 'a');
    const child = spawn(def.bin ?? 'node', def.args, {
      cwd: def.cwd,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
    });
    this.writePid(def.name, child.pid!);
    child.unref();
    fs.closeSync(fd);
    this.logger.log(`start ${def.name} pid=${child.pid} log=${logFile}`);
    return { name, started: true, pid: child.pid };
  }

  /** 停止进程 */
  async stop(name: string) {
    const def = resolveProc(name);
    if (name === 'api') {
      // 后端自停: 延迟自杀(detached, 响应先返回)
      this.suicide();
      return { name, stopping: true, note: '后端延迟退出中' };
    }
    const pid = await this.readPid(def.name) ?? (await findPidByPort(def.port));
    if (pid) {
      await this.killPid(pid);
      this.removePid(def.name);
      this.logger.log(`stop ${def.name} pid=${pid}`);
      return { name, stopped: true, pid };
    }
    return { name, stopped: false, reason: 'not-running' };
  }

  /** 重启 */
  async restart(name: string) {
    if (name === 'api') {
      // 后端自启: detached 守护脚本(2s 杀旧 → 3s 起新)
      this.spawnApiGuardian();
      return { name, restarting: true, note: '后端重启中(~5s)' };
    }
    await this.stop(name);
    // 等端口释放
    await this.waitPortFree(defPortOf(name));
    return this.start(name);
  }

  /** 一键全停(顺序杀 web/admin/proxy, api 最后延迟自杀) */
  async stopAll() {
    const results: Array<Record<string, unknown>> = [];
    for (const def of PROC_DEFS) {
      if (def.name === 'api') continue;
      results.push(await this.stop(def.name));
    }
    this.suicide();
    return { results, api: { stopping: true, note: '后端延迟退出中' } };
  }

  // ---------- 内部 ----------

  private async killPid(pid: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const { exec } = require('child_process');
      exec(`taskkill /F /PID ${pid} /T`, () => resolve());
    });
  }

  private async waitPortFree(port: number, timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!(await probePort(port))) return;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  /** 后端自停: spawn detached cmd 延迟 2s 杀自己(不带 /T, 避免连累管理器 spawn 的其它服务) */
  private suicide() {
    const ownPid = process.pid;
    const script = `timeout /t 2 /nobreak >nul & taskkill /F /PID ${ownPid}`;
    const child = spawn('cmd', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    this.logger.log(`后端自停已调度(pid=${ownPid})`);
  }

  /** 后端自启守护: 延迟杀旧 → 起新 node dist/main.js → 写新 pid */
  private spawnApiGuardian() {
    const oldPid = process.pid;
    const apiDef = resolveProc('api');
    const logFile = path.join(LOG_DIR, 'api.log');
    // 用 node -e 内联脚本避免临时文件
    const script = `
      const { spawn, exec } = require('child_process');
      const fs = require('fs');
      setTimeout(() => {
        exec('taskkill /F /PID ${oldPid}', () => {
          setTimeout(() => {
            const fd = fs.openSync(${JSON.stringify(logFile)}, 'a');
            const c = spawn('node', ${JSON.stringify(apiDef.args)}, { cwd: ${JSON.stringify(apiDef.cwd)}, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
            fs.writeFileSync(${JSON.stringify(path.join(PID_DIR, 'api.pid'))}, String(c.pid));
            c.unref();
            fs.closeSync(fd);
          }, 3000);
        });
      }, 2000);
    `;
    const child = spawn('node', ['-e', script], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    this.logger.log('后端自启守护已调度');
  }

  private pidFile(name: string) {
    return path.join(PID_DIR, `${name}.pid`);
  }

  private writePid(name: string, pid: number) {
    fs.writeFileSync(this.pidFile(name), String(pid));
  }

  private readPid(name: string): number | null {
    try {
      return Number(fs.readFileSync(this.pidFile(name), 'utf8')) || null;
    } catch {
      return null;
    }
  }

  private removePid(name: string) {
    try { fs.unlinkSync(this.pidFile(name)); } catch { /* 忽略 */ }
  }
}

function defPortOf(name: string): number {
  return resolveProc(name).port;
}
