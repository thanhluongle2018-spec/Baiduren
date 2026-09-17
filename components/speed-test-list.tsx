import Link from "next/link";
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
  formatSpeed,
} from "@/lib/format";
import type { SpeedTestRecord } from "@/types";

export function SpeedTestList({ records }: { records: SpeedTestRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">暂无演示测速记录。</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>机场 / 节点</TableHead>
          <TableHead>测速点</TableHead>
          <TableHead>模式</TableHead>
          <TableHead>延迟</TableHead>
          <TableHead>下载</TableHead>
          <TableHead>稳定性</TableHead>
          <TableHead>时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>
              <Link href={`/airports/${record.airportSlug}`} className="hover:underline">
                {record.airportName}
              </Link>
              <p className="text-xs text-muted-foreground">{record.nodeName}</p>
            </TableCell>
            <TableCell>
              {record.serverName}
              <p className="text-xs text-muted-foreground">{record.region}</p>
            </TableCell>
            <TableCell>
              {record.mode === "MULTI_THREAD" ? "多线程" : "单线程"}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {formatLatency(record.result.latencyMs)}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {formatSpeed(record.result.downloadMbps)}
            </TableCell>
            <TableCell className="font-mono tabular-nums">
              {formatPercent(record.result.stability)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span>{formatDateTime(record.finishedAt)}</span>
                <Badge variant="outline" className="border-amber-300 text-amber-800">
                  演示
                </Badge>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
