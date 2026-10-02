# AI 督学馆（未完工废案）

> [!WARNING]
> 本项目是一份**未完工的废案**。代码、文档与设计均不完整，未经过完整验证，**不具备任何实际价值**，不建议部署或用于生产环境。本仓库仅作为历史记录和参考材料保留，不提供维护、支持或后续更新承诺。
>
> This repository is an **unfinished, abandoned draft**. It is incomplete,
> unverified, and has **no practical value**. It is preserved for reference
> only and is not intended for deployment or production use.

番茄钟 + AI 视觉巡查 + 荣誉与社交体系的专注训练应用。

## 文档导航

- [TECHNICAL.md](./TECHNICAL.md)：全技术文档，模块、数据表与判定链路
- [backend/README.md](./backend/README.md)：后端启动、环境变量、接口与测试
- [frontend/README.md](./frontend/README.md)：前端页面、巡查链路与构建排错

## 运行范围

本仓库只保留应用源码与有限的开发参考说明，**不包含任何本地部署、反向代理、进程守护、自动备份、公网发布或生产运行资料**。

## 技术栈

- **前端**:Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS v3 + zustand + PWA
- **后端**:NestJS 10 + TypeORM + JWT (access 15min / refresh 30d 旋转)
- **数据库**:默认 SQL.js(WASM,零安装零编译,文件 `backend/data/aidushu.sqlite`);可选 PostgreSQL(改 `DB_TYPE=postgres`)
- **AI 判定**:抽象层 `IFocusVisionProvider`,开发期 Mock 厂商

## 快速开始

```bash
# 1. 后端 (端口 3001)
cd backend
cp .env.example .env        # 可选；Windows 可用 Copy-Item
npm ci
npm run start:dev

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

## 管理接口

源码包含一组仅允许本机或局域网访问的管理接口（`LocalIpGuard`），提供用户、统计、突击检查和 AI 配置能力。仓库不提供启动位置、端口映射或访问入口说明。

## 开源许可

本项目采用 [MIT License](./LICENSE)。请勿提交 `.env`、本地数据库、用户上传图片、日志或备份；安全和凭据处理说明见 [SECURITY.md](./SECURITY.md)。
