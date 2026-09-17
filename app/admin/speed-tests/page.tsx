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
import { listSpeedTests } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "测速管理",
};

export const dynamic = "force-dynamic";

export default async function AdminSpeedTestsPage() {
  const payload = await listSpeedTests();

  return (
    <div>
      <AdminPageHeader
        title="SpeedTest 管理"
        description="只读列表。正式测速任务仍由后续 Worker 写入。"
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
          {payload.data.map((test) => (
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
