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
import { promotions } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "推广管理",
};

export default function AdminPromotionsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Promotion 管理"
        description="占位列表。推广链接与点击记录将写入 Promotion / PromotionClick，当前不跳转真实联盟接口。"
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
          {promotions.map((promotion) => (
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
