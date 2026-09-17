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
import { airports } from "@/lib/demo-data";
import { formatScore } from "@/lib/format";

export const metadata: Metadata = {
  title: "机场管理",
};

export default function AdminAirportsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Airport 管理"
        description="占位列表。后续将改为读取 Prisma Airport 表，并提供创建 / 编辑表单。"
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
          {airports.map((airport) => (
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
