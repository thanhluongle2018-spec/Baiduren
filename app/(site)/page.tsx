import Link from "next/link";
import { AirportCard } from "@/components/airport-card";
import { DemoBanner } from "@/components/demo-banner";
import { RankingTable } from "@/components/ranking-table";
import { SpeedTestList } from "@/components/speed-test-list";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { airports, speedTests } from "@/lib/demo-data";
import { getRankingPreview } from "@/lib/data/ranking";

export default async function HomePage() {
  const rankingPreview = await getRankingPreview(5);
  const popularAirports = airports.slice(0, 4);

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
              用可核对的测速字段评估机场表现。第一阶段先搭好网站、数据模型与页面骨架；
              真实测速由后续独立 Worker / Agent 写入数据库，再汇总到排行榜。
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
              <DemoBanner message="首页、排行榜与详情页均使用演示数据，便于核对字段，不是实测结果。" />
              <p>
                后续链路：测速服务器 → 测速任务 → 执行测速 → 写入 SpeedTest /
                SpeedTestResult → 排行榜聚合。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="演示机场"
            value={String(airports.length)}
            hint="虚构样本，非真实接入"
          />
          <StatCard
            label="演示测速记录"
            value={String(speedTests.length)}
            hint="占位指标，待 Worker 替换"
          />
          <StatCard
            label="数据来源"
            value="Demo"
            hint="lib/demo-data.ts"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">排行榜预览</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              结构与正式排行榜一致，方便以后替换数据源。
            </p>
          </div>
          <Link href="/ranking" className={buttonVariants({ variant: "outline", size: "sm" })}>
            完整排行榜
          </Link>
        </div>
        <Card>
          <CardContent className="pt-4">
            <RankingTable rows={rankingPreview} compact />
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-lg font-semibold tracking-tight">热门机场</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          演示样本，用于核对卡片布局。
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
          以下数值为演示占位，包含延迟、下载速度、稳定性等字段。
        </p>
        <Card>
          <CardContent className="pt-4">
            <SpeedTestList records={speedTests} />
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
              <CardTitle>第一阶段范围</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              已完成项目骨架、Prisma 模型、基础 API、首页 / 排行榜 / 机场详情 /
              后台占位。未接入真实机场、真实节点或第三方测速 API。
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
