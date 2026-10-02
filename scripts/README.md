# 部署与运维脚本

本目录是 Windows 下的部署入口，所有脚本都通过相对路径定位项目根目录，可整体移动。

## 脚本一览

| 脚本 | 作用 | 使用方式 |
| --- | --- | --- |
| `start-all.bat` | 启动后端 3001、主站 3000、管理面板 3002、反向代理 8888，并在进程退出后 3 秒自动重启 | 双击，或登录时由任务计划调用 |
| `register-tasks.bat` | 注册 `aidushu-start`（登录自启）和 `aidushu-backup`（每日 04:00 备份）两个任务计划 | 右键“以管理员身份运行” |
| `backup.bat` | 备份 SQLite 数据库与 `backend/uploads` 到 `backups/<时间戳>`，仅保留最近 7 份 | 手动双击，或由任务计划调用 |

## 启动前置条件

`start-all.bat` 直接运行构建产物和 `next start`，不会自动安装依赖或构建。首次部署或更新代码后先执行：

```powershell
cd backend
npm ci
npm run build

cd ..\frontend
npm ci
npm run build
```

完成后再运行 `start-all.bat`。

## 进程与端口

| 进程 | 端口 | 说明 |
| --- | --- | --- |
| `aidushu-api` | 3001 | NestJS 后端 |
| `aidushu-web` | 3000 | Next.js 主站 |
| `aidushu-admin` | 3002 | 管理面板，绑定 `127.0.0.1`，仅本机访问 |
| `aidushu-proxy` | 8888 | 反向代理，供 SakuraFrp 隧道接入 |

脚本会在独立的最小化窗口中启动各进程，关闭对应窗口即停止该进程。

## 反向代理行为

`proxy.js` 的路由规则：

- `/api/admin/*` → 直接返回 `403`
- `/api/*` → `127.0.0.1:3001`
- 其它路径 → `127.0.0.1:3000`

这样公网隧道只能访问用户端与普通接口，建号等管理操作必须在本机直连后端完成。

## 备份说明

`backup.bat` 备份以下内容：

- `backend/data/aidushu.sqlite`（含 `-wal` / `-shm` 文件，若存在）
- `backend/uploads/` 下的所有违纪快照与突击检查图片

备份目录名使用 `YYYYMMDD-HHMM` 格式，按目录名倒序保留最近 7 份，更早的会被删除。备份目录默认被根目录 `.gitignore` 忽略，不要手动把真实用户数据提交到版本库。

## 日志与进程文件

- 手动启动脚本的窗口输出就是各进程日志。
- 根目录 `logs/` 保存过由诊断方式启动的日志文件。
- `.pids/` 保存部分进程的 PID 文件。
- `logs/`、`.pids/`、`backups/` 都是运行数据，不属于源码。

## 常见问题

- **双击后窗口闪退**：先在命令行运行对应 `.bat`，查看错误；通常是依赖未安装或未构建。
- **端口被占用**：用 `netstat -ano | findstr :3000` 等命令定位进程，再通过管理面板“进程”页或任务管理器处理。
- **任务计划未注册**：`register-tasks.bat` 需要管理员权限；用 `schtasks /query /tn aidushu-start` 验证。
- **备份文件很大**：`uploads/` 中主要是用户抓帧图片，可按需调整 `backup.bat` 的清理策略，但不要在跑服务时直接删除原目录。
