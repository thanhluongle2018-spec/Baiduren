import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { speedTests } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "测速管理",
};

export default function AdminSpeedTestsPage() {
  return (
    <div>
      <AdminPageHeader
        title="SpeedTest 管理"
        description="占位列表。正式测速任务将由 Worker 写入 SpeedTest / SpeedTestResult，后台只做查询与复核。"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>机场</TableHead>
            <TableHead>节点</TableHead>
            <TableHead>模式</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {speedTests.map((test) => (
            <TableRow key={test.id}>
              <TableCell className="font-mono text-xs">{test.id}</TableCell>
              <TableCell>{test.airportName}</TableCell>
              <TableCell>{test.nodeName}</TableCell>
              <TableCell>
                {test.mode === "MULTI_THREAD" ? "多线程" : "单线程"}
              </TableCell>
              <TableCell>{test.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
