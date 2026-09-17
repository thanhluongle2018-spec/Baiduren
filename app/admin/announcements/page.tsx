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
import { announcements } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "公告管理",
};

export default function AdminAnnouncementsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Announcement 管理"
        description="占位列表。后续可在此发布站点公告。"
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
          {announcements.map((item) => (
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
