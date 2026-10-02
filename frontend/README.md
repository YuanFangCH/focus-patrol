# AI 督学馆 · 前端

Next.js 14（App Router）主站与管理面板，包含番茄钟工作台、摄像头巡查、荣誉、好友和后台管理界面。

## 技术要点

- **框架**：Next.js 14 + React 18 + TypeScript
- **样式**：Tailwind CSS 3
- **状态**：zustand（认证、会话状态机、设置、巡查预览）
- **巡查预筛**：浏览器端 `32×32` 灰度指纹，画面无变化不上传，降低 AI 调用量
- **PWA**：通过 `app/manifest.ts` 提供清单，图标在 `public/icon.svg`

## 快速开始

```powershell
cd frontend
npm ci

# 开发模式
npm run dev                       # http://localhost:3000

# 生产模式（本机部署使用）
npm run build
npm start                         # 主站 3000
```

管理面板与主站共用同一份构建产物，单独用另一个进程启动：

```powershell
node node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3002
# 打开 http://127.0.0.1:3002/admin
```

本机部署时建议直接使用根目录的 `scripts/start-all.bat`，它会同时拉起后端、主站、管理面板和反向代理，并带崩溃自愈。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:3001` | API 基址；设为 `/` 表示同源，由反向代理转发 |

默认情况下 `next.config.js` 会把浏览器发往 `/api/*` 的请求 rewrite 到 `http://127.0.0.1:3001`。经 `proxy.js`（8888）部署时，将 `.env.production.example` 复制为 `.env.production` 并使用 `NEXT_PUBLIC_API_BASE=/`。

## 目录结构

```
app/
├─ page.tsx              # 营销首页
├─ login/                # uid 登录页
├─ app/                  # 登录后的工作台（番茄钟、摄像头、荣誉、好友）
├─ app/settings/         # 用户设置
├─ admin/                # 管理面板（仅本机可访问）
├─ guide/ faq/           # 使用说明与常见问题
├─ privacy/              # 隐私政策
├─ privacy-camera/       # 摄像头与影像隐私说明
└─ updates/              # 更新记录
components/
├─ pomodoro/             # 番茄钟计时器
├─ patrol/               # 督学官弹层与违纪档案
├─ camera/               # 摄像头预览与抓帧
├─ honor/                # 荣誉卡片
├─ social/               # 好友面板
├─ admin/                # 用户管理、进程控制、AI 配置
└─ common/               # 心跳、突击检查轮询等运行时组件
lib/
├─ api/                  # 统一请求封装与各模块接口
├─ store/                # zustand 状态
└─ vision/               # 指纹预筛、巡查引擎、抓帧与档案
```

## 页面与访问控制

| 路径 | 说明 |
| --- | --- |
| `/` | 产品首页 |
| `/login` | 输入管理员分发的 8 位 uid 登录 |
| `/app` | 专注工作台，未登录会依次尝试 IP 免登、记住的 uid，失败后跳登录页 |
| `/admin` | 管理面板，仅允许本机/局域网 Host，公网访问会重定向回首页 |
| `/guide`、`/faq`、`/privacy`、`/privacy-camera`、`/updates` | 说明类页面 |

`middleware.ts` 会对 `/admin/:path*` 做 Host 校验；`proxy.js` 还会在网络层拦截 `/api/admin/*`，两层保护不要删。

## 巡查与计时链路

1. `PomodoroTimer` 通过 `sessionStore` 创建 / 结束 / 中断后端会话。
2. `patrolEngine` 定时抓帧，先用 `fingerprint.ts` 做本地感知哈希预筛。
3. 有显著变化或达到强制巡查间隔时，上传到 `POST /api/patrols/evaluate`。
4. 遮挡等可本地判断的情况走 `POST /api/patrols/local-rule`，违纪帧随手留档。
5. `PatrolOverlay` 展示判定与违纪提醒，`PatrolArchivePanel` 查看/删除本人快照。
6. `AppRuntime` 全局挂载在线心跳与突击检查轮询。

## 构建与排错

- **改了接口地址不生效**：`NEXT_PUBLIC_*` 在构建时写入产物，修改后需重新 `npm run build`。
- **生产页面样式异常**：先删除 `.next` 重新构建，再确认 Tailwind 配置未被覆盖。
- **dev 模式在受限环境不可用**：某些受管环境可能限制临时文件清理，部署时统一使用 `npm run build` + `next start`。
- **管理面板打不开**：使用 `http://127.0.0.1:3002/admin`，并确认管理进程由 `-H 127.0.0.1` 启动。
- **API 请求 502**：确认后端 `3001` 已启动；使用相对路径时还要确认反向代理或 rewrite 生效。
