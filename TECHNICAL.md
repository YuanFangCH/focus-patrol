# AI 督学馆 · 全技术文档（未完工废案）

> [!WARNING]
> 本文档对应的是一份**未完工的废案**，仅用于记录当时的实现思路与代码结构。
> 文档内容可能与代码不一致，未经验证，**不具备任何实际价值**，不应作为部署或生产环境依据。

> 技术深度文档：架构、模块、路由、实体、全局机制、AI 判定链路、巡查链路、部署。
> 快速上手与组件说明见仓库根目录 `README.md`。

---

## 1. 项目概览

**产品**：AI 督学馆 —— 番茄钟 + AI 巡查 + 荣誉体系的专注训练营。
**目标用户**：需要自律/他律监督的人群；管理员通过后台建号分发 8 位 uid，用户凭 uid 免密登录。

| | 技术 | 版本 |
|---|---|---|
| 前端 | Next.js App Router + React + TypeScript + Tailwind CSS + zustand | next 14.2 / react 18 / zustand 4 |
| 后端 | NestJS + TypeORM + JWT + class-validator | nest 10 / typeorm |
| 数据库 | SQL.js (WASM 内存库，默认，零安装) | sql.js |
| 生产数据库 | PostgreSQL 16（`DB_TYPE=postgres` 切换） | pg |
| 认证 | JWT access + refresh 轮换 | @nestjs/jwt |
| AI 判定 | 多商家视觉路由（GLM 免费优先） | HttpService 手写 OpenAI 兼容 |

---

## 2. 仓库结构

```
focus-patrol/
├─ backend/               NestJS 后端（端口 3001）
│  ├─ src/
│  │  ├─ main.ts          应用入口：前缀/cors/pipe/拦截器/过滤器
│  │  ├─ app.module.ts    模块、数据库、限流与调度装配
│  │  ├─ common/          全局守卫/拦截器/异常过滤器/装饰器
│  │  ├─ entities/        15 个实体文件（14 注册的表 + 1 废弃）
│  │  ├─ modules/         业务模块（见 §3）
│  │  ├─ vision/          AI 判定抽象层（见 §6）
│  ├─ scripts/            CLI 工具（建号）
│  ├─ data/               本地 SQL.js 数据库（gitignored）
│  ├─ uploads/            本地巡查图片（gitignored）
│  └─ .env.example        环境变量示例
├─ frontend/              Next.js 前端（端口 3000，管理面板 3002）
│  ├─ app/                App Router 页面
│  ├─ components/         组件（番茄钟/巡查/管理/摄像头/荣誉…）
│  ├─ lib/                api 封装 / zustand store / 指纹+巡查引擎
│  └─ .env.production.example 生产构建同源 API 示例
├─ proxy.js               本地反向代理（端口 8888）
├─ docker-compose.yml     PG+Redis+API+Adminer 编排
├─ scripts/               运维批处理（start-all/backup/register-tasks）
└─ backups/ logs/ .pids/  本地运行数据（gitignored）
```

---

## 3. 后端模块与路由

全局前缀 `api`。除 `@Public()` 标注外，全部默认走 JwtAuthGuard（Bearer access token）。

### 3.1 auth（认证）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/login` | uid 登录（@Public，限流 10/分/IP），body `{uid, rememberIp?}`；绑定 IP 后返回 token |
| POST | `/auth/ip-login` | IP 免登（@Public，限流 20/分），经 `ip_bindings` 命中则签发 token |
| POST | `/auth/refresh` | refresh 轮换（@Public），body `{refreshToken}` |
| POST | `/auth/logout` | 吊销 refresh + 提升 tokenVersion 踢线 |

### 3.2 user
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/users/me` | 当前用户（含荣誉/成就聚合） |

### 3.3 session（番茄钟状态机）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/sessions` | 创建，body `{durationMinutes, mode=off\|camera\|screen, type=focus\|break}` |
| POST | `/sessions/:id/end` | 结束，body `{actualSeconds}`；**break 类型不结算荣誉**（返回 score:0/exp:0） |
| POST | `/sessions/:id/interrupt` | 中断 |
| GET | `/sessions` | 列表 `?status&page&size` |
| GET | `/sessions/:id` | 详情 |

### 3.4 honor（荣誉）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/honor/me` | 我的等级/经验/勋章 |
| GET | `/honor/levels` | 等级种子（@Public） |

### 3.5 patrol（巡查）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/patrols/evaluate` | multipart 上传单帧判定，`?sessionId=&source=`，图片 ≤2MB |
| GET | `/patrols/check/task` | 突击检查任务认领（用户端 20s 轮询） |
| POST | `/patrols/check/submit` | 突击提交抓帧，multipart，`?taskId=&source=`，≤1MB |
| POST | `/patrols/local-rule` | 本地规则判定落库（camera 遮挡→away） |
| GET | `/patrols` | 按会话查巡查记录 `?sessionId=` |
| GET | `/patrols/:id/snapshot` | 违纪快照原图（StreamableFile，`image/jpeg`） |
| DELETE | `/patrols/:id/snapshot` | 删除快照 |

### 3.6 social（好友）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/social/requests` | 收到的申请 |
| POST | `/social/requests` | 发起申请，body `{userId}` |
| POST | `/social/requests/:id/accept` `/reject` | 接受/拒绝 |
| GET | `/social/friends` | 好友列表 |
| DELETE | `/social/friends/:userId` | 删除好友 |

### 3.7 notification（通知）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/notifications` | `?limit&offset`（上限 100） |
| POST | `/notifications/:id/read` `/read-all` | 单条/全部已读 |

### 3.8 track（在线心跳，内存版）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/track/ping` | 心跳，body `{sessionId?}`；TTL 90s |
| POST | `/track/leave` | 离开清除 |
| GET | `/track/online` | `?userIds=a,b` → `{online:[...]}` |

### 3.9 admin（管理，LocalIpGuard + @Public，仅本机/局域网）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST/GET | `/admin/users` | 建号(批量)/列表(分页搜索+online) |
| GET | `/admin/users/:id` | 用户详情（会话/巡查/勋章聚合） |
| GET | `/admin/users/:id/realtime` | 实时状态（在线/当前会话/违规） |
| PATCH | `/admin/users/batch` | 批量改昵称/启停 |
| PUT | `/admin/users/:id/uid` | 自定义/改 8 位 uid（校验字符集） |
| PATCH | `/admin/users/:id` | 改昵称/状态 |
| DELETE | `/admin/users/:id` | 删除（级联清理） |
| GET | `/admin/stats` | 全局统计 |
| POST/GET | `/admin/patrol/spot/:userId` | 发起/历史突击检查 |
| GET/DELETE | `/admin/patrol/spot/:userId/image` | 突击原图查看(StreamableFile)/删除 |
| GET | `/admin/processes/status` | 四进程状态 |
| POST | `/admin/processes/start\|stop\|restart\|stop-all` | 进程控制 |

### 3.10 ai-config（AI 厂商配置，LocalIpGuard + @Public）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/ai-config` | 厂商列表（key 掩码） |
| GET | `/admin/ai-config/usage` | 用量统计（`?days=`，今日/近 N 天） |
| PUT | `/admin/ai-config/:provider` | 更新 `{apiKey,modelName,baseUrl,enabled,dailyQuota}`（apiKey 空=不改） |

---

## 4. 数据表（14 张）

| 表 | key 字段 | 说明 |
|---|---|---|
| users | id(uuid), uid(8位唯一), nickname, role, status, honor_level_id, honor_exp, token_version, last_active_at | 用户 |
| refresh_tokens | token_hash(sha256), user_id, device_fp, expires_at, revoked_at, replaced_by | refresh 轮换 |
| focus_sessions | user_id, status(running/completed/interrupted), type(focus/break), mode, duration_minutes, actual_seconds, score | 番茄钟会话 |
| patrol_records | session_id, source, result(focus/distracted/away/unknown), confidence, model, is_violation, snapshot_url | 巡查记录 |
| violation_snapshots | patrol_record_id, object_key, width/height/size_bytes | 违纪快照 |
| spot_checks | user_id, status(pending/done), result, object_key, source | 突击检查 |
| honor_levels | name, min_exp, icon_url | 等级种子（青铜→王者） |
| achievements | code(unique), name, icon_url | 勋章 |
| user_achievements | (user_id, achievement_id) PK, unlocked_at | 已解锁勋章 |
| friendships | requester_id/addressee_id, status | 好友 |
| notifications | user_id, type, title, body, related_id, is_read | 通知 |
| ai_configs | provider(volcengine/qwen/glm), model_name, api_key_cipher(encrypted), base_url, priority, enabled, daily_quota | AI key 加密表 |
| ai_usage | provider, model, usage_date, call_count, token_count | 用量按日聚合 |
| ip_bindings | ip(unique), user_id, label | IP 绑定免登 |

> 注：`sms-code.entity.ts` 存在但**未在 entities/index.ts 注册**（废弃的验证码遗留）。

---

## 5. 后端全局机制

### 5.1 main.ts
- `setGlobalPrefix('api')`
- `trust proxy = 'loopback'`（经 getHttpAdapter().getInstance().set），只信本机一跳，防公网伪造 XFF
- CORS：读 `CORS_ORIGINS`（逗号分隔白名单），未设则全放开 + credentials
- 全局 `ValidationPipe({ whitelist, transform })`
- 全局 `TransformInterceptor`：统一 `{ code:0, data, message }`；**`data instanceof StreamableFile` 返回原样不包装**（否则图片流被 JSON 化看不了）
- 全局 `AllExceptionsFilter`：统一错误 `{ code, data:null, message }`
- 监听 `PORT` || 3001

### 5.2 认证
- access token 15 分钟（JwtModule），refresh 30 天（DB 存储 + 旋转）
- **401 静默刷新**由前端 client.ts 负责（用 refreshToken 换新 token，防并发风暴）
- `JwtStrategy` 校验 `token_version` 实现"踢线"（改 uid/禁用/登出即失效）
- uid 登录限流 `@Throttle(10/min)`；IP 免登 `@Throttle(20/min)`
- 装饰器：`@Public()`、`@CurrentUser()`

### 5.3 AI key 安全
- AI key **只存 ai_configs 表加密**（aes-256-gcm，密钥 `sha256(JWT_SECRET)` 派生，`modules/ai-config/cipher.util`）
- env 直读优先；`getKey(provider)` 解密注入 provider
- 管理面板只显示掩码，明文永不出后端

---

## 6. AI 视觉判定链路（vision/）

```
前端巡查引擎采集帧(32×32 指纹预筛) 
  └─显著变化/起步期强制 → frameToJpeg → POST /patrols/evaluate
      └─ AIVisionRouter.evaluate(buffer, ctx)
          └─ 按生效链依次尝试: GLM(免费) → Qwen(付费兜底) → Volcengine
              ├─成功 → 记录 ai_usage(actor/tokens) → 返回 {result, confidence, model}
              └─失败(401/429/超时/格式) → 记失败用量 → 切下一通道
          └─全部失败 → {result:'unknown', confidence:0}（不误罚用户）
```

- **免费优先**：provider 构造顺序 `[Glm, Qwen, Volcengine]`；**可用性过滤**（onModuleInit）只保留已配置有效 key 的通道（`keyOk` 集合，env 或 ai_configs 任一命中；mock 恒保留）。输出生效链日志如 `可用通道过滤: glm → qwen → volcengine => qwen`。
- **接口** `IFocusVisionProvider { name, providerKey, evaluate(), setKey?, setModel?, setBaseUrl? }`。
- **providerKey 必须对应 ai_configs.provider 键**（用 `p.providerKey` 查 key；若误用 `p.name` 会查不到）。
- **OpenAI 兼容**：`POST {baseUrl}/chat/completions`，body 含 `messages[].content`（text + `image_url:data:image/jpeg;base64`）。
- **超时**：qwen 30s / volc 20s / glm 20s（真实图需 >8s，原 8s 太短致超时失败→unknown）。
- **厂商**：
  - GLM：`glm-4v-flash`（**永久免费**，智谱），`https://open.bigmodel.cn/api/paas/v4/chat/completions`
  - Qwen：`qwen-vl-plus`（公开视觉模型），`https://dashscope.aliyuncs.com/compatible-mode/v1`（baseUrl 缺 `/chat/completions` 由 `endpoint()` 补齐）
  - Volcengine：`doubao-vision-pro`（付费）
- **AI_PROVIDER** 环境变量：`mock`（开发占位）或其它（走真实链）。

---

## 7. 前端巡查链路（lib/vision/）

### 7.1 fingerprint.ts（本地预筛）
- `downscaleToGray`：帧降到 32×32 灰度
- `grayToHash`：感知哈希（128B）
- `fingerprintDiff`：0~1 帧间差
- `frameStats`/`classifyFrame`：黑(<8)/白(>247)/纯色(std<6) → 遮挡类
- `frameToJpeg(q=0.7)`：截帧转 JPEG

### 7.2 patrolEngine.ts（巡查引擎）
- `PATROL_FREQUENCY_MAP`：slow(采样60s/上传120s) / normal(30s/60s) / nightmare(10s/15s)
- **起步期强制巡查**：`WARMUP_MS=5min`，`WARMUP_INTERVAL_MS=60s`。前 5 分钟画面**静止也强制每 60s 上传判定一次**（否则静止画面永不巡查）；起步期后按难度档位 + 画面变化阈值。
- 流程：采流 → 指纹预筛 → 本地规则（camera 遮挡连续 2 次→`/patrols/local-rule` 判 away；screen 遮挡仅跳过防误判）→ 节流 → 上传单帧。
- `getUserMedia`/`getDisplayMedia` 采集；`previewStore` 外部流复用时跳过自采（不二次占用摄像头）。

### 7.3 突击检查
- 全局 `SpotCheckPoller` 每 20s 认领 `/patrols/check/task`；有任务从 `previewStore` 流截帧（`frameToJpeg` ≤1MB）上传 `/patrols/check/submit`。
- 管理员 `POST /admin/patrol/spot/:userId` 发起；原图存 `uploads/spot/{userId}/{spotId}.jpg`，经 StreamableFile 查看。

---

## 8. 番茄钟（前端）

- **sessionStore**：单会话状态机 phase + remainingSeconds + unlimited（无限时长=后端按 180min 创建，前端正向计时）。
- **longClockStore**：长时间番茄钟调度器。总时长 = 多段学习 + 休息交替；**唯一终止条件 `accumulatedStudySeconds >= totalStudySeconds → finish()`**（防无限循环）。订阅 sessionStore 收敛到 completed 触发切段；`earlyBreak`（学习段提前休息）/`startNextStudy`（休息段开始下一段）。
- **break 会话**：创建 `type:'break'`，强制 mode='off'（无巡查），结束不结算荣誉。
- settingsStore 长时配置：`longMode / longTotalMinutes / longStudyMinutes(≥25≤总时长) / longBreakMinutes(1~30)`。

---

## 9. 部署与运维

### 9.1 本机四服务（SakuraFrp 方案）
| 服务 | 端口 | 命令 |
|---|---|---|
| 后端 | 3001 | `cd backend && node dist/main.js` |
| 前端主站 | 3000 | `cd frontend && node node_modules/next/dist/bin/next start -p 3000` |
| 管理面板 | 3002 | `cd frontend && node .../next start -H 127.0.0.1 -p 3002`（仅本机） |
| 反代 | 8888 | `node proxy.js` |

- 免手动：`scripts/start-all.bat`（含崩溃自愈循环）、`register-tasks.bat`（任务计划）、`backup.bat`（每日备份保留 7 份）。
- **proxy.js**：`/api/*`→3001，其余→3000，**`/api/admin/*` 一律 403**（防 LocalIpGuard 被隧道穿透）。
- **修改后端必须 `nest build` 再重启**（跑的是 dist 产物，非 ts 源码）。

### 9.2 前端生产构建
- **部分受管环境会限制 `next dev` 的临时文件操作** → 部署统一用 `next build` + `next start` 生产模式。
- `next.config.js` 必须有 rewrites 代理 `/api/*→3001`（否则 3000 直连 /api 404）。
- 将 `.env.production.example` 复制为 `.env.production` 并设 `NEXT_PUBLIC_API_BASE=/`（同源），client.ts 用 fetch + BASE_PREFIX。
- 管理面板 3002 的 admin.ts **硬编码直连 `127.0.0.1:3001/api/admin`，不带 JWT**（设计意图，需管理面板与本机同机）。

### 9.3 数据库
- `DB_TYPE=sqlite`（sqljs，文件 `backend/data/aidushu.sqlite`，零安装）／`postgres`（DATABASE_URL）。
- **sqljs 内存库覆盖**：后端运行期间直接改 sqlite 文件不生效且会被 autoSave 覆盖 → 数据变更**必须走后端接口/进程内操作**。
- 改 sqljs 数据需**先停后端**再改文件、重启生效。

### 9.4 环境变量
复制 `backend/.env.example` 为 `backend/.env` 后按需修改：
`NODE_ENV / PORT / DB_TYPE / DB_FILE / REDIS_HOST / REDIS_PORT / JWT_SECRET / JWT_REFRESH_SECRET / UPLOAD_DIR / SMS_PROVIDER / AI_PROVIDER`

### 9.5 回归测试（后端启动后）
```
cd backend && node test-m2.mjs      # 巡查全链路
cd backend && node test-m3.mjs      # 荣誉/好友/心跳/通知（20 项）
cd backend && node e2e-patrol.mjs   # 端到端巡查
```

---

## 10. 已知约束与踩坑

1. **StreamableFile 必须被 TransformInterceptor 放行**，否则图片被 JSON 化、前端看不了。
2. **AI key 注入用 providerKey 而非 name**。
3. **uid 取模必须 %UID_CHARS.length**（字符集 31 位，排除 0/1/O/I；误用 32 会越界）。
4. **改 .env 的 AI_PROVIDER / AI key 需重启后端**（key 在 onModuleInit 注入）。
5. **文件删除用 try/catch 兜底**（沙箱 safe-delete 拦截批量删除）。
6. **ai_usage 重启清零**（sqljs 内存库）；历史 volc/glm 的 calls 是加过滤前 401 残留，非 bug。
7. **redis/ioredis** 依赖已装，但 track 当前用内存 Map（切 Redis 时接口不变）。
