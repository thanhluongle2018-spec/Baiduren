import type { Metadata } from "next";
import { DemoBanner } from "@/components/demo-banner";
import { RankingTable } from "@/components/ranking-table";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { getAirportRanking } from "@/lib/data/ranking";

export const metadata: Metadata = {
  title: "排行榜",
};

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const payload = await getAirportRanking();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">机场排行榜</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        延迟、下载、上传、丢包和成功率为 SpeedTestResult 平均值。综合评分为库存参考字段，本阶段不定稿算法。
        当前排序按平均下载速度，仅用于展示。
      </p>
      <div className="mt-4">
        {payload.demo ? (
          <DemoBanner message={siteConfig.rankingNotice} />
        ) : (
          <p className="text-sm text-muted-foreground">当前为数据库聚合结果。</p>
        )}
      </div>
      <Card className="mt-6">
        <CardContent className="pt-4">
          <RankingTable rows={payload.data} demo={payload.demo} />
        </CardContent>
      </Card>
    </div>
  );
}
