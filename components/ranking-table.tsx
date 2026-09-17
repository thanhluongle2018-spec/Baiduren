import Link from "next/link";
import { AirportLogo } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatLatency,
  formatPercent,
  formatScore,
  formatSpeed,
} from "@/lib/format";
import type { RankingRow } from "@/types";

export function RankingTable({
  rows,
  compact = false,
  demo = true,
}: {
  rows: RankingRow[];
  compact?: boolean;
  demo?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>排名</TableHead>
          <TableHead>机场</TableHead>
          <TableHead>参考评分</TableHead>
          <TableHead>延迟</TableHead>
          <TableHead>下载速度</TableHead>
          {!compact ? <TableHead>上传速度</TableHead> : null}
          {!compact ? <TableHead>丢包</TableHead> : null}
          {!compact ? <TableHead>成功率</TableHead> : null}
          <TableHead>稳定性</TableHead>
          <TableHead>价格</TableHead>
          {compact ? null : <TableHead>更新时间</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={compact ? 7 : 11} className="text-muted-foreground">
              暂无排行数据。
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.airportId}>
              <TableCell className="font-mono tabular-nums">{row.rank}</TableCell>
              <TableCell>
                <Link
                  href={`/airports/${row.slug}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <AirportLogo text={row.logoText} className="size-7 text-xs" />
                  <span>{row.name}</span>
                </Link>
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatScore(row.score)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatLatency(row.latencyMs)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {formatSpeed(row.downloadMbps)}
              </TableCell>
              {compact ? null : (
                <TableCell className="font-mono tabular-nums">
                  {formatSpeed(row.uploadMbps)}
                </TableCell>
              )}
              {compact ? null : (
                <TableCell className="font-mono tabular-nums">
                  {formatPercent(row.packetLoss)}
                </TableCell>
              )}
              {compact ? null : (
                <TableCell className="font-mono tabular-nums">
                  {formatPercent(row.successRate)}
                </TableCell>
              )}
              <TableCell className="font-mono tabular-nums">
                {formatPercent(row.stability)}
              </TableCell>
              <TableCell>{row.priceLabel}</TableCell>
              {compact ? null : (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatDateTime(row.updatedAt)}
                    </span>
                    {demo ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-800"
                      >
                        演示
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
