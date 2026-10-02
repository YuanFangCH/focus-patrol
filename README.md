# AI 督学馆

番茄钟 + AI 视觉巡查 + 荣誉与社交体系的专注训练应用。

## 文档导航

- [TECHNICAL.md](./TECHNICAL.md)：全技术文档，模块、数据表与判定链路
- [backend/README.md](./backend/README.md)：后端启动、环境变量、接口与测试
- [frontend/README.md](./frontend/README.md)：前端页面、巡查链路与构建排错
- [scripts/README.md](./scripts/README.md)：一键启动、任务计划与备份脚本
- [installers/README.md](./installers/README.md)：安装包目录约定

## 技术栈

- **前端**:Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS v3 + zustand + PWA
- **后端**:NestJS 10 + TypeORM + JWT (access 15min / refresh 30d 旋转)
- **数据库**:默认 SQL.js(WASM,零安装零编译,文件 `backend/data/aidushu.sqlite`);生产切 PostgreSQL(改 `DB_TYPE=postgres`)
- **AI 判定**:抽象层 `IFocusVisionProvider`,开发期 Mock 厂商

## 快速开始

```bash
# 1. 后端 (端口 3001)
cd backend
cp .env.example .env        # 可选；Windows 可用 Copy-Item
npm ci
npm run start:dev           # 或 npm run build && npm run start:prod

# 2. 前端 (端口 3000)
cd frontend
npm ci
npm run dev
```

打开 http://localhost:3000 → 凭唯一 uid 登录(uid 由管理员通过 create-user 脚本生成并分发)。

## 认证方式(唯一 uid 登录)

1. 管理员建号:`cd backend && node scripts/create-user.js --nickname 小明 --count 5`(仅本机可调,经 `POST /api/admin/users`)
2. 建号后输出 8 位 uid(如 `A7K9Q2M4`),分发给用户
3. 用户在前端登录页输入 uid 即可登录(uid 即凭证,无密码)
4. 已废弃:手机号验证码登录、游客登录(接口已移除)
5. 登录限流:`POST /auth/login` 10 次/分/IP,防 uid 暴力枚举

## 环境变量

见各目录 `.env.example`:
- `backend/.env.example`:DB_TYPE / JWT_SECRET / AI_PROVIDER
- `frontend/.env.production.example`: 同源部署时的 `NEXT_PUBLIC_API_BASE`

## 目录结构

```
backend/src/
├─ common/         # 全局守卫/拦截器/异常过滤器/装饰器
├─ entities/       # 14 张注册表 + 1 个已废弃实体的 TypeORM 定义
├─ modules/
│  ├─ auth/        # 唯一 uid 登录、JWT+refresh 轮换
│  ├─ user/        # 用户档案
│  ├─ session/     # 番茄钟状态机
│  ├─ honor/       # 荣誉等级/勋章种子数据
│  ├─ patrol/      # 巡查判定/违纪快照(30 天清理)
│  ├─ social/      # 好友系统
│  ├─ notification/# 通知
│  ├─ track/       # 在线心跳(内存版)
│  └─ admin/       # 管理接口(本机 IP 白名单,建号)
├─ vision/         # AI 判定抽象层(IFocusVisionProvider + 路由 + 厂商适配器)
└─ main.ts         # 统一响应 { code, data, message }

frontend/
├─ app/            # App Router 页面(营销页/工作台/登录/guide/faq/privacy*)
├─ components/
│  ├─ pomodoro/    # 番茄钟 UI
│  └─ patrol/      # 督学官弹层(违纪提醒/快照查看删除)
└─ lib/
   ├─ api/         # api client、auth/sessions/patrols
   ├─ store/       # authStore、sessionStore(状态机)
   └─ vision/      # 亮度指纹预筛 + 巡查引擎(采集/节流/上传)
```

## 巡查(M2)说明

- 前端本地把帧降采样 32×32 灰度感知哈希,画面无显著变化不上传(省流量省 AI 费用)
- `POST /api/patrols/evaluate?sessionId=&source=` 上传单帧判定
- 判定非违纪帧立即丢弃;违纪帧存快照(仅本人可见),30 天后自动删除,可手动删
- AI 提供商:开发期 Mock(`AI_PROVIDER=mock`);生产接豆包/通义/智谱(见 `src/vision/providers/`)
- 回归测试:`cd backend && node test-m2.mjs`(需后端已启动)

## 社交(M3)说明

- 荣誉结算:完成番茄钟自动累加 EXP,达到阈值升级(青铜学徒→白银卫士→黄金督学→钻石督军→王者);成就勋章首次解锁
- 好友:输入对方用户 ID 发起申请 → 对方收到通知 → 接受/拒绝;好友间可见在线状态
- 在线心跳:前端 30s 轮询 `/track/ping`,离开页面自动 `/track/leave`(SQLite 版为内存实现,切 Redis 时接口不变)
- 通知:好友申请/同意等事件写入通知中心,支持单条已读/全部已读
- 回归测试:`cd backend && node test-m3.mjs`(需后端已启动)

## 里程碑进度

- [x] M1 认证 + 番茄钟(uid 登录、会话落库、得分结算)
- [x] M2 AI 巡查(本地指纹预筛 + /patrols/evaluate + 违纪快照 + 督学官 UI)
- [x] M3 荣誉 + 社交(加分升段 + 勋章 + 好友互关 + 在线心跳 + 通知)
- [x] M4 本机部署 + 安全加固(反代 + JWT 强密钥 + CORS 白名单 + 备份)
- [x] M4.5 管理面板(用户管理 + 数据查看, 本机 3002)
- [ ] M5 SakuraFrp 公网穿透(需用户操作 SakuraLauncher 建隧道)

## 管理面板

```bash
# 独立进程(仅本机): scripts/start-all.bat 已含,或手动:
cd frontend && npx next start -H 127.0.0.1 -p 3002
# 浏览器打开 http://127.0.0.1:3002/admin
# 功能: 全局统计 / 用户搜索分页 / 建号(批量生成 uid) / 详情(会话·巡查·勋章聚合) / 禁用启用(即时踢线) / 删除(级联清理)
# 安全: LocalIpGuard 仅本机; proxy.js 对 /api/admin/* 403; middleware 拦非本机 Host 访问 /admin
```

## 本机部署(SakuraFrp 方案 A)

```bash
# 四服务:
#   后端 node dist/main.js           → 3001
#   前端 node node_modules/... next start -p 3000 → 3000
#   管理面板 next start -H 127.0.0.1 -p 3002     → 3002(仅本机)
#   反代 node proxy.js               → 127.0.0.1:8888 (/api/*→3001 其余→3000, /api/admin/* 403)
# 一键启动(含崩溃自愈): scripts/start-all.bat
# 任务计划注册(管理员): scripts/register-tasks.bat
# 每日备份(保留7份):    scripts/backup.bat (或任务计划 aidushu-backup 每日 04:00)

# SakuraFrp 建站(用户操作):
# 1. SakuraLauncher 登录 → 创建 TCP 隧道
# 2. 节点选非内地(香港, 免备案; TCP 隧道穿透 HTTP 禁止内地节点)
# 3. 本地 IP 127.0.0.1, 本地端口 8888, 开「自动 HTTPS」
# 4. 启动后访问 https://节点域名:端口
# 5. 证书告警按官方 frpc/ssl.html 配置; 启动器「安装为系统服务」开机自启
# 安全: 建号仅限本机直连 3001(/api/admin/* 经隧道一律 403); CORS 可用 CORS_ORIGINS 白名单
```

## 生产部署(后续, 备选)

```bash
# docker-compose 四服务(api/postgres/redis/adminer)需装 Docker Desktop
# 数据库切 PG:DB_TYPE=postgres + DATABASE_URL
# 前端可部署 Vercel 或 COS+CDN
```

## 开源许可

本项目采用 [MIT License](./LICENSE)。请勿提交 `.env`、本地数据库、用户上传图片、日志或备份；安全和凭据处理说明见 [SECURITY.md](./SECURITY.md)。
