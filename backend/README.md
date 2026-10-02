# AI 督学馆 · 后端

NestJS 10 + TypeORM 的 API 服务，默认监听 `3001`，全局前缀 `/api`，统一响应格式为 `{ code, data, message }`。

## 技术要点

- **框架**：NestJS 10 + TypeScript
- **数据库**：默认 SQL.js（WASM，零安装零编译，文件 `data/aidushu.sqlite`）；设 `DB_TYPE=postgres` 可切 PostgreSQL
- **认证**：8 位 uid 免密登录，JWT access token 15 分钟 + refresh token 30 天旋转
- **安全**：登录限流（`10 次/分/IP`）、管理接口 `LocalIpGuard` 仅本机/局域网、AI key 加密存库
- **巡查**：`IFocusVisionProvider` 抽象层，厂商适配器免费优先（GLM → Qwen → Volcengine）

## 快速开始

```powershell
cd backend
npm ci
Copy-Item .env.example .env   # 可选；不建 .env 时使用默认值
npm run start:dev             # 开发模式（热重载）

# 生产模式
npm run build
npm run start:prod            # 等价于 node dist/main.js
```

启动后访问 `http://localhost:3001/api`。改完后端代码后必须重新构建再重启生产进程（`npm run build`）。

## 环境变量

完整示例见 [`.env.example`](./.env.example)，常用项：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | HTTP 监听端口 |
| `DB_TYPE` | `sqlite` | `sqlite` 或 `postgres` |
| `DB_FILE` | `./data/aidushu.sqlite` | SQL.js 数据库文件 |
| `DATABASE_URL` | - | PostgreSQL 连接串，配置后优先使用 |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | 开发占位值 | 生产必须改为强随机值，修改后已登录用户全部失效 |
| `UPLOAD_DIR` | `./uploads` | 违纪快照 / 突击检查图片目录 |
| `AI_PROVIDER` | `mock` | `mock` 走本地假判定；其它值启用真实厂商链 |
| `CORS_ORIGINS` | 空 | 逗号分隔白名单；为空时开发期放开全部来源 |

AI 厂商的 API key、模型名和 base URL 一般不在 `.env`，而是在管理面板写入 `ai_configs` 表（加密存储）。只有 `AI_PROVIDER` 需要在此处配置。

## 目录结构

```
src/
├─ common/          # 全局守卫、拦截器、异常过滤器、装饰器、工具
├─ entities/        # TypeORM 实体（用户、会话、巡查、荣誉、社交等）
├─ modules/
│  ├─ auth/         # uid 登录、IP 免登、JWT 刷新、登出
│  ├─ user/         # 当前用户档案
│  ├─ session/      # 番茄钟会话状态机与结算
│  ├─ honor/        # 等级、经验、成就
│  ├─ patrol/       # AI 巡查、本地规则、突击检查、违纪快照
│  ├─ social/       # 好友申请与好友列表
│  ├─ notification/ # 通知中心
│  ├─ track/        # 在线心跳（当前为内存版）
│  ├─ admin/        # 管理面板接口（仅本机）
│  └─ ai-config/    # AI 厂商配置与用量统计
├─ vision/          # 视觉判定抽象层与厂商适配器
├─ app.module.ts
└─ main.ts
```

## 主要接口

所有路由都以 `/api` 开头，除标注 `@Public` 的接口外均需 `Authorization: Bearer <accessToken>`。

| 分组 | 路由 | 说明 |
| --- | --- | --- |
| 认证 | `POST /auth/login`、`POST /auth/ip-login`、`POST /auth/refresh`、`POST /auth/logout` | uid 登录与 token 管理 |
| 用户 | `GET /users/me` | 当前用户档案 |
| 会话 | `POST /sessions`、`POST /sessions/:id/end`、`POST /sessions/:id/interrupt`、`GET /sessions` | 番茄钟生命周期 |
| 荣誉 | `GET /honor/me`、`GET /honor/levels` | 等级与成就 |
| 巡查 | `POST /patrols/evaluate`、`POST /patrols/local-rule`、`GET /patrols`、`GET /patrols/:id/snapshot`、`DELETE /patrols/:id/snapshot` | 判定、记录、快照 |
| 突击检查 | `GET /patrols/check/task`、`POST /patrols/check/submit` | 管理员发起、用户端提交抓帧 |
| 社交 | `/social/requests`、`/social/friends` | 好友申请与关系 |
| 通知 | `GET /notifications`、`POST /notifications/:id/read`、`POST /notifications/read-all` | 通知中心 |
| 在线 | `POST /track/ping`、`POST /track/leave`、`GET /track/online` | 在线状态心跳 |
| 管理 | `/admin/users`、`/admin/stats`、`/admin/processes/*`、`/admin/ai-config/*` | 仅本机/局域网可访问 |

## 建号

后端启动后，在本机执行：

```powershell
node scripts/create-user.js --nickname 小明 --count 5
node scripts/create-user.js --count 3 --json          # 输出 JSON 方便分发
node scripts/create-user.js --url http://localhost:3001
```

脚本会调用本机管理接口 `POST /api/admin/users`。公网经反代访问 `/api/admin/*` 会被 `proxy.js` 直接返回 `403`。

## 测试与验证

以下脚本需要后端已启动，且大多依赖系统 `curl`：

```powershell
node test-m2.mjs                 # M2 巡查全链路
node test-m3.mjs                 # M3 荣誉 + 社交 + 通知 + 在线
node e2e-patrol.mjs              # 端到端 multipart 巡查
node verify-admin.cjs            # 管理接口完整验证（建号/禁用/删除级联）
node verify-proxy-snapshot.cjs   # 违纪快照经 8888 反代全链路
```

辅助脚本：`_verify-stats.cjs` 直接读 SQLite 统计会话与巡查数据，`_test-localrule.cjs` 验证本地规则违纪帧留档，`test-insert.js` 检查 TypeORM 写入。

## 常见问题

- **改了代码不生效**：生产进程运行的是 `dist/`，执行 `npm run build` 后重启。
- **改了 SQLite 文件不生效**：SQL.js 运行期间以内存库为准，先停后端再改文件，或统一走接口修改。
- **AI 判定一直 `unknown`**：`AI_PROVIDER` 仍为 `mock`，或 `ai_configs` / 环境变量里没有可用 key；查看后端日志中的可用通道过滤结果。
- **快照接口返回 JSON 而不是图片**：确认 `TransformInterceptor` 放行了 `StreamableFile`。
- **生产安全**：务必替换 `JWT_SECRET`、`JWT_REFRESH_SECRET`，并配置 `CORS_ORIGINS` 白名单。
- **许可证**：MIT，见仓库根目录 `LICENSE`。
