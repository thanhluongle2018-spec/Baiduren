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
  formatStatus,
} from "@/lib/format";
import type { SpeedTestRecord } from "@/types";

function metric(value: number | null | undefined, format: (n: number) => string) {
  if (value == null) return "—";
  return format(value);
}

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
          <TableHead>测速服务器</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>延迟</TableHead>
          <TableHead>单线程下载</TableHead>
          <TableHead>多线程下载</TableHead>
          <TableHead>单线程上传</TableHead>
          <TableHead>多线程上传</TableHead>
          <TableHead>丢包</TableHead>
          <TableHead>成功率</TableHead>
          <TableHead>测试时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const result = record.result;
          return (
            <TableRow key={record.id}>
              <TableCell>
                <Link href={`/airports/${record.airportSlug}`} className="hover:underline">
                  {record.airportName}
                </Link>
                <p className="text-xs text-muted-foreground">{record.nodeName || "—"}</p>
              </TableCell>
              <TableCell>
                {record.serverName}
                <p className="text-xs text-muted-foreground">{record.region}</p>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span>{formatStatus(record.status)}</span>
                  {record.errorMessage ? (
                    <span className="max-w-[12rem] truncate text-xs text-muted-foreground">
                      {record.errorMessage}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.latencyMs, formatLatency)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.downloadSingleMbps, formatSpeed)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.downloadMultiMbps, formatSpeed)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.uploadSingleMbps, formatSpeed)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.uploadMultiMbps, formatSpeed)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.packetLossPercent ?? result?.packetLoss, formatPercent)}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {metric(result?.successRatePercent ?? result?.successRate, formatPercent)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>
                    {formatDateTime(result?.measuredAt ?? result?.testedAt ?? record.finishedAt)}
                  </span>
                  {record.isDemo ? (
                    <Badge variant="outline" className="border-amber-300 text-amber-800">
                      演示
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
