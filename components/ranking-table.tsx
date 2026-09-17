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
}: {
  rows: RankingRow[];
  compact?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>排名</TableHead>
          <TableHead>机场</TableHead>
          <TableHead>综合评分</TableHead>
          <TableHead>延迟</TableHead>
          <TableHead>下载速度</TableHead>
          <TableHead>稳定性</TableHead>
          <TableHead>价格</TableHead>
          {compact ? null : <TableHead>更新时间</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
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
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-800"
                  >
                    演示
                  </Badge>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
