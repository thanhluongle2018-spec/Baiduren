# 摆渡人（BaiduRen）

机场测评、节点测速与数据排行榜网站。

当前为第一阶段：网站基础架构、数据库模型、页面骨架与演示数据。  
**页面上的测速结果和用户评价均为演示数据，不是真实测量或真实评价。**

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
| `npx prisma studio` | 打开数据浏览器 |
| `npx prisma db seed` | 写入演示数据（需已 migrate） |

Prisma 配置在 `prisma.config.ts`，模型在 `prisma/schema.prisma`。  
应用代码通过 `lib/prisma.ts` 的 `getPrisma()` 懒加载客户端，前端页面第一阶段不直接打数据库。

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

生产环境需要有效的 `DATABASE_URL`。第一阶段页面仍读取演示数据；Prisma 客户端已生成，便于下一阶段切换。

## 后续测速系统架构说明

测速不与前端页面强耦合。计划中的数据流：

```
测速服务器（SpeedTestServer / Agent）
        ↓
   创建测速任务（SpeedTest）
        ↓
   Worker 执行测速（单线程 / 多线程）
        ↓
   回写结果（SpeedTestResult）
        ↓
   数据库聚合
        ↓
   排行榜 / 机场详情
```

结果字段预留：

- 延迟、下载速度、上传速度
- 丢包率、连接成功率、稳定性
- 测试时间、测试地区、测试服务器、被测节点

代码入口：

- 领域类型：`lib/speedtest/types.ts`
- 任务队列占位：`lib/speedtest/queue.ts`
- Stub 客户端：`lib/speedtest/client.ts`（只记录任务意图，不探测任何节点）
- 排行榜数据层：`lib/data/ranking.ts`（以后把 `demo-data` 换成数据库聚合）

Worker / Agent 应作为独立进程部署，通过数据库或消息队列与网站通信，而不是在 Next.js 请求里发起测速。

## 页面

- `/` 首页
- `/ranking` 排行榜
- `/airports/[slug]` 机场详情
- `/admin` 后台占位（机场 / 测速 / 评价 / 推广 / 公告）

## API

均为演示数据，响应带 `demo: true`：

- `GET /api/health`
- `GET /api/ranking`
- `GET /api/airports`
- `GET /api/airports/[slug]`
- `GET /api/speed-tests`
- `GET /api/reviews`
- `GET /api/announcements`
