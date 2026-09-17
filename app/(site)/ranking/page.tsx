import type { Metadata } from "next";
import { DemoBanner } from "@/components/demo-banner";
import { RankingTable } from "@/components/ranking-table";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";
import { getAirportRanking } from "@/lib/data/ranking";

export const metadata: Metadata = {
  title: "排行榜",
};

export default async function RankingPage() {
  const rows = await getAirportRanking();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">机场排行榜</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        排名依据演示综合评分。正式环境将改为聚合 SpeedTestResult 的延迟、下载速度、稳定性等指标。
      </p>
      <div className="mt-4">
        <DemoBanner message={siteConfig.rankingNotice} />
      </div>
      <Card className="mt-6">
        <CardContent className="pt-4">
          <RankingTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
