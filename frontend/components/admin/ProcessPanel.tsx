'use client';

/** 服务控制面板: 4 进程状态灯 + PID + 启动/停止/重启 + 一键全停 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, type ProcessStatus } from '@/lib/api/admin';

const NAME_MAP: Record<string, string> = {
  api: '后端 API',
  web: '主站前端',
  admin: '管理面板',
  proxy: '本地反代',
};

export default function ProcessPanel() {
  const [list, setList] = useState<ProcessStatus[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminApi.processStatus();
      setList(r.list);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    timer.current = setInterval(() => void load(), 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const act = async (fn: () => Promise<unknown>, label: string, name: string) => {
    setBusy(name);
    try {
      await fn();
      // 操作后延时刷新(进程启停需要时间)
      await new Promise((r) => setTimeout(r, 1200));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmStopAll = () => {
    if (!confirm('⚠️ 确定停止全部 4 个服务?\n后端将延迟退出,需用 scripts/start-all.bat 重新启动!')) return;
    void act(() => adminApi.processStopAll(), '全停', 'all');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-900">服务控制</p>
        <button
          onClick={confirmStopAll}
          disabled={busy !== null}
          className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-40 transition"
        >
          一键全停
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map((p) => {
          const name = NAME_MAP[p.name] ?? p.name;
          const isBusy = busy === p.name;
          return (
            <div
              key={p.name}
              className="p-4 rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      p.running ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <span className="font-medium text-slate-800">{name}</span>
                  <span className="text-xs text-slate-400 font-mono">:{p.port}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {p.running ? `PID ${p.pid ?? '?'}` : '已停止'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void act(() => adminApi.processStart(p.name), '启动', p.name)}
                  disabled={p.running || isBusy}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  启动
                </button>
                <button
                  onClick={() => void act(() => adminApi.processStop(p.name), '停止', p.name)}
                  disabled={!p.running || isBusy}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300 disabled:opacity-40 transition"
                >
                  停止
                </button>
                <button
                  onClick={() => void act(() => adminApi.processRestart(p.name), '重启', p.name)}
                  disabled={!p.running || isBusy}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-40 transition"
                >
                  重启
                </button>
              </div>
              {isBusy && <p className="mt-2 text-[11px] text-brand-500">操作中…</p>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        提示: 停止/重启「后端 API」会短暂中断管理面板(本页由后端提供数据),操作后自动恢复;
        全部停止后需在服务器上运行 <code className="bg-slate-100 px-1 rounded">scripts/start-all.bat</code> 重新启动。
      </p>
    </div>
  );
}
