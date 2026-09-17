import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AirportLogo } from "@/components/brand-mark";
import { DemoBanner } from "@/components/demo-banner";
import { PlanList } from "@/components/plan-list";
import { ReviewList } from "@/components/review-list";
import { SpeedTestList } from "@/components/speed-test-list";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAirportDetail } from "@/lib/data/airports";
import {
  formatLatency,
  formatPercent,
  formatScore,
  formatSpeed,
} from "@/lib/format";

type AirportPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: AirportPageProps): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getAirportDetail(slug);
  if (!payload.data) {
    return { title: "机场未找到" };
  }
  return { title: payload.data.name };
}

export default async function AirportDetailPage({ params }: AirportPageProps) {
  const { slug } = await params;
  const payload = await getAirportDetail(slug);
  const airport = payload.data;
  if (!airport) {
    notFound();
  }

  const latest = airport.speedTests[0];
  const metricHint = payload.demo ? "演示测速" : "最近测速";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <AirportLogo text={airport.logoText} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{airport.name}</h1>
            <Badge variant="secondary">{airport.categoryName}</Badge>
            {payload.demo ? (
              <Badge variant="outline" className="border-amber-300 text-amber-800">
                演示数据
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {airport.description}
          </p>
        </div>
      </div>

      {payload.demo ? (
        <div className="mt-4">
          <DemoBanner />
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="参考评分"
          value={formatScore(airport.score)}
          hint="非最终算法"
        />
        <StatCard
          label="延迟"
          value={latest ? formatLatency(latest.result.latencyMs) : "—"}
          hint={metricHint}
        />
        <StatCard
          label="下载速度"
          value={latest ? formatSpeed(latest.result.downloadMbps) : "—"}
          hint={metricHint}
        />
        <StatCard
          label="稳定性"
          value={latest ? formatPercent(latest.result.stability) : "—"}
          hint={metricHint}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">套餐</h2>
        <PlanList plans={airport.plans} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">节点信息</h2>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {airport.nodes.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell>{node.name}</TableCell>
                    <TableCell>{node.region}</TableCell>
                    <TableCell>{node.kind}</TableCell>
                    <TableCell>{node.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">测速记录</h2>
        <Card>
          <CardContent className="pt-4">
            <SpeedTestList records={airport.speedTests} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">用户评价</h2>
        <ReviewList records={airport.reviews} />
      </section>

      {airport.promotions.length > 0 ? (
        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>推广位</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              推广记录保存在 Promotion 表中。当前不展示真实跳转，affiliateUrl
              仅为 example.com 占位。
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
