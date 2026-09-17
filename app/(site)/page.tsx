import Link from "next/link";
import { AirportCard } from "@/components/airport-card";
import { DemoBanner } from "@/components/demo-banner";
import { RankingTable } from "@/components/ranking-table";
import { SpeedTestList } from "@/components/speed-test-list";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { listAirports } from "@/lib/data/airports";
import { listSpeedTests } from "@/lib/data/content";
import { getRankingPreview } from "@/lib/data/ranking";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rankingPreview = await getRankingPreview(5);
  const airportList = await listAirports();
  const latestTests = await listSpeedTests();
  const popularAirports = airportList.data.slice(0, 4);
  const sourceLabel = rankingPreview.source === "database" ? "Database" : "Demo";
  const sourceHint =
    rankingPreview.source === "database"
      ? rankingPreview.demo
        ? "PostgreSQL 演示 seed"
        : "PostgreSQL 正式数据"
      : "内存演示数据";

  return (
    <div>
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary">
              {siteConfig.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {siteConfig.tagline}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              用可核对的测速字段评估机场表现。本阶段已接入 PostgreSQL + Prisma；
              真实测速仍由后续独立 Worker / Agent 写入数据库，再汇总到排行榜。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/ranking" className={buttonVariants()}>
                查看排行榜
              </Link>
              <Link
                href="/airports/dukou-yun"
                className={buttonVariants({ variant: "outline" })}
              >
                打开演示机场
              </Link>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>数据说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              {rankingPreview.demo ? (
                <DemoBanner message="当前展示演示数据。数据库有正式机场后将自动切换。" />
              ) : (
                <p>当前列表来自 PostgreSQL，测速指标由 SpeedTestResult 聚合，综合评分算法尚未定稿。</p>
              )}
              <p>
                数据链路：测速服务器 → 测速任务 → 执行测速 → 写入 SpeedTest /
                SpeedTestResult → 排行榜聚合。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="机场"
            value={String(airportList.data.length)}
            hint={airportList.demo ? "演示或 seed 样本" : "数据库记录"}
          />
          <StatCard
            label="测速记录"
            value={String(latestTests.data.length)}
            hint="完成态 SpeedTestResult"
          />
          <StatCard label="数据来源" value={sourceLabel} hint={sourceHint} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">排行榜预览</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              延迟、下载、上传等为测速结果平均值；综合评分本阶段仅作参考字段。
            </p>
          </div>
          <Link href="/ranking" className={buttonVariants({ variant: "outline", size: "sm" })}>
            完整排行榜
          </Link>
        </div>
        <Card>
          <CardContent className="pt-4">
            <RankingTable rows={rankingPreview.data} compact demo={rankingPreview.demo} />
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-lg font-semibold tracking-tight">热门机场</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          来自当前数据源的前四条机场。
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popularAirports.map((airport) => (
            <AirportCard key={airport.id} airport={airport} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-lg font-semibold tracking-tight">最新测速</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          最近测速任务，含测速服务器、状态与单/多线程指标。未完成任务没有结果字段。
        </p>
        <Card>
          <CardContent className="pt-4">
            <SpeedTestList records={latestTests.data} />
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">关于摆渡人</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              摆渡人面向需要对照机场信息、套餐、测速记录与排行榜的用户。
              网站本身不提供代理连接，也不下发节点配置。测速系统与前端页面解耦，
              以后可以独立增加 Worker、Agent 与测速节点。
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>第二阶段范围</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              已接入 PostgreSQL + Prisma，以及模拟测速 Worker。
              尚未开发真实节点探测、管理员登录与后台 CRUD。
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
