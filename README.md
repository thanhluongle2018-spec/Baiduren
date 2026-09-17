# 摆渡人（BaiduRen）

机场测评、节点测速与数据排行榜网站。

当前为第三阶段 B-1：机场订阅内容可以解析为统一节点，并写入现有 `Node` 表。
第三阶段 A 的测速任务、Worker、模拟执行器与排行榜聚合仍然可用。
**页面上的测速结果和用户评价均为演示数据，不是真实测量或真实评价。本阶段不会探测真实机场、不会拉取远程订阅、也不会建立代理连接。**

定位文案：机场测评 · 节点测速 · 数据排行榜

本仓库不提供代理连接、不下发节点配置、不接入真实机场或第三方测速 API。

## 技术栈

- Next.js 16（App Router）
- TypeScript（strict）
- Tailwind CSS 4
- shadcn/ui
- PostgreSQL 16
- Prisma 7
- ESLint
- Docker Compose（仅用于本地 PostgreSQL）

## 安装依赖

```bash
npm install
```

`postinstall` 会执行 `prisma generate`。

## 环境变量配置

复制示例文件：

```bash
cp .env.example .env
```

需要配置：

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_USER` | PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | PostgreSQL 密码（不要使用示例值上线） |
| `POSTGRES_DB` | 数据库名 |
| `POSTGRES_PORT` | 宿主机端口 |
| `DATABASE_URL` | Prisma 连接串 |

`.env` 与 `.env.local` 已被 gitignore，不要把真实密码、API Key、推广链接或管理员口令写入源码。

## PostgreSQL 配置

使用 Docker 启动本地数据库：

```bash
docker compose up -d
```

确认 `.env` 中的账号与 `DATABASE_URL` 一致。数据库就绪后再执行 migration。

## Prisma 使用方法

| 命令 | 作用 |
| --- | --- |
| `npx prisma generate` | 生成客户端到 `lib/generated/prisma` |
| `npx prisma validate` | 校验 schema |
| `npx prisma migrate deploy` | 应用已有 migration |
| `npx prisma studio` | 打开数据浏览器 |
| `npx prisma db seed` | 写入演示数据（需已 migrate） |
| `npm run worker` | 启动模拟测速 Worker（独立进程） |
| `npm test` | 状态机 / mock executor / Worker / 订阅解析测试 |

Prisma 配置在 `prisma.config.ts`，模型在 `prisma/schema.prisma`。  
应用代码通过 `lib/prisma.ts` 的 `getPrisma()` 懒加载客户端。页面优先读库，库空或不可用时回退内存演示数据。

## 数据库 migration

```bash
npx prisma migrate dev --name init
```

已有 migration 目录时，新环境使用：

```bash
npx prisma migrate deploy
```

核心模型：

- `User`
- `Category`
- `Airport`
- `AirportPlan`
- `Node`
- `SpeedTestServer`（为后续测速节点预留）
- `SpeedTest`
- `SpeedTestResult`
- `Review`
- `Promotion`
- `PromotionClick`
- `Announcement`

## 本地启动

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma migrate dev
npm run dev
```

开发服务器默认端口：`43127`。

打开 [http://127.0.0.1:43127](http://127.0.0.1:43127)

当前页面数据来自 `lib/demo-data.ts`。没有数据库时，网站仍可启动并浏览演示内容。

## Production build

```bash
npm run build
npm run start
```

生产环境需要有效的 `DATABASE_URL`。页面是 `force-dynamic` 的，build 不要求库里已经有测速数据。

## 测速系统架构（第三阶段 A）

测速不在 Next.js 请求里执行。当前数据流：

```
createSpeedTestJob() / POST /api/speed-tests（仅 demo）
        ↓
SpeedTest（PENDING）
        ↓
Worker 领取任务（PostgreSQL FOR UPDATE SKIP LOCKED）
        ↓
检查 SpeedTestServer.maxConcurrentTests
        ↓
Mock executor（模拟指标，isDemo=true）
        ↓
SpeedTestResult + SpeedTest SUCCESS/FAILED
        ↓
排行榜聚合最近 24 小时有效结果
```

状态机：

- `PENDING → RUNNING → SUCCESS`
- `RUNNING → FAILED`
- `PENDING | RUNNING → CANCELLED`

`COMPLETED` 仍保留为早期成功态，排行榜把它和 `SUCCESS` 同等对待。

并发控制：

- 以数据库中该测速服务器当前 `RUNNING` 数量对照 `maxConcurrentTests`
- 任务领取使用事务 + `FOR UPDATE SKIP LOCKED`，可从数据库恢复，不依赖进程内变量
- `lib/speedtest/prisma-queue.ts` 是队列端口实现，便于以后换成 Redis/BullMQ

本阶段绝对不会：

- 连接真实机场或代理节点
- 扫描公网
- 访问真实机场订阅
- 写入真实服务器 IP

代码入口：

- 创建任务：`lib/speedtest/jobs.ts`
- Worker：`lib/speedtest/worker.ts`
- 模拟执行器：`lib/speedtest/mock-executor.ts`
- 状态机：`lib/speedtest/state-machine.ts`
- 数据库队列：`lib/speedtest/prisma-queue.ts`
- 独立进程：`scripts/speedtest-worker.ts`（`npm run worker`）
- 排行榜聚合：`lib/data/ranking.ts`（最近 24 小时，综合评分仍用库存参考字段）

## 页面

- `/` 首页
- `/ranking` 排行榜
- `/airports/[slug]` 机场详情
- `/admin` 后台占位（机场 / 测速 / 评价 / 推广 / 公告）

## API

均为演示数据，响应带 `demo: true`：

- `GET /api/health`
- `GET /api/ranking`（最近 24 小时有效结果聚合）
- `GET /api/airports`
- `GET /api/airports/[slug]`
- `GET /api/speed-tests`（最近任务，含状态、测速服务器与结果）
- `POST /api/speed-tests`（只创建 demo/mock 任务，拒绝真实测速）
- `GET /api/reviews`
- `GET /api/announcements`
- `POST /api/airports/[slug]/nodes/parse`（传入订阅内容，解析并 upsert 节点；不返回凭据或 rawConfig）

## 订阅解析（第三阶段 B-1）

本阶段只做「解析和标准化」，不执行代理、不测速、不评分。

```
订阅内容（YAML / URI / base64 URI 列表）
        ↓
Clash / Mihomo / URI 解析
        ↓
NormalizedNode
        ↓
按 fingerprint upsert Node（消失节点 PAUSED，不物理删除）
```

支持的输入：

- Clash / Mihomo YAML 的 `proxies`
- base64 编码的代理 URI 列表
- 单个 `ss://` `vmess://` `trojan://` `vless://`

支持的协议：`ss`、`vmess`、`trojan`、`vless`、`socks5`、`http`。
无法安全标准化的类型返回 `UNSUPPORTED_PROTOCOL`，不会伪造节点。

安全边界：

- 不实现 HTTP 拉取订阅，因此没有 SSRF 面
- `rawConfig` 只存数据库，不出现在普通 GET/POST 响应
- 日志和错误信息不包含 password / uuid / token / 完整订阅 URL
- 输入超过 512KiB 会被拒绝

`regionHint` 只根据节点名称推断（HK / JP / US / TW / SG / UNKNOWN），不是真实 IP 地理位置。

Clash YAML 里的 `https` 会标准化为协议 `http`，并保留 `tls: true`。Runtime 不能把它当成明文 HTTP 代理。

## 代理运行时（第三阶段 B-2）

本阶段建立 Worker 后续可调用的 Proxy Runtime，**不进行下载/上传/多线程测速，不改 Mock Executor，不接入真实评分**。

```
start ProxyRuntime
        ↓
localhost mixed-port（仅 127.0.0.1）
        ↓
healthCheck
        ↓
受控连通性验证（HTTP via proxy）
        ↓
stop + 删除临时配置
```

实现：

- 抽象：`lib/proxy-runtime/`（`start` / `stop` / `getProxyEndpoint` / `healthCheck`）
- 真实核心适配：`MihomoProcessRuntime`（需要本机 `mihomo`/`clash-meta` 或 `BAIDUREN_MIHOMO_BIN`）
- 测试夹具：`FakeProxyRuntime` + `tests/helpers/stub-mihomo.mjs`

当前默认开发环境**没有预装 Mihomo/Xray**。自动化测试用 Fake Runtime 和 stub 子进程验证生命周期与「请求经过 proxy」。没有真实机场节点、没有真实订阅拉取。

设置 `BAIDUREN_MIHOMO_BIN` 指向本机 Mihomo 后，ProcessRuntime 才会启动真实核心。在完成环境验证之前，不能把 Fake/stub 结果当成真实机场代理已经跑通。
