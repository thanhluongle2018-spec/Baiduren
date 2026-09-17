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
import { listAnnouncements } from "@/lib/data/content";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "公告管理",
};

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const payload = await listAnnouncements();

  return (
    <div>
      <AdminPageHeader
        title="Announcement 管理"
        description="只读列表。发布与编辑仍待后续阶段。"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>发布时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payload.data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.status}</TableCell>
              <TableCell>{formatDateTime(item.publishedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
