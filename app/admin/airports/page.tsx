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
import { listAirports } from "@/lib/data/airports";
import { formatScore } from "@/lib/format";

export const metadata: Metadata = {
  title: "机场管理",
};

export const dynamic = "force-dynamic";

export default async function AdminAirportsPage() {
  const payload = await listAirports();

  return (
    <div>
      <AdminPageHeader
        title="Airport 管理"
        description="只读列表。创建 / 编辑仍待后续阶段。"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>评分</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payload.data.map((airport) => (
            <TableRow key={airport.id}>
              <TableCell>{airport.name}</TableCell>
              <TableCell className="font-mono text-xs">{airport.slug}</TableCell>
              <TableCell>{formatScore(airport.score)}</TableCell>
              <TableCell>{airport.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
