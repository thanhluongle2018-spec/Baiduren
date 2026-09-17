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
import { listPromotions } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "推广管理",
};

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const payload = await listPromotions();

  return (
    <div>
      <AdminPageHeader
        title="Promotion 管理"
        description="只读列表。当前不跳转真实联盟接口。"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>机场</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>点击</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payload.data.map((promotion) => (
            <TableRow key={promotion.id}>
              <TableCell>{promotion.airportName}</TableCell>
              <TableCell>{promotion.name}</TableCell>
              <TableCell>{promotion.status}</TableCell>
              <TableCell>{promotion.clickCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
