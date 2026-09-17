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
import { listReviews } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "评价管理",
};

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const payload = await listReviews();

  return (
    <div>
      <AdminPageHeader
        title="Review 管理"
        description="只读列表。审核与状态变更仍待后续阶段。"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>机场</TableHead>
            <TableHead>评分</TableHead>
            <TableHead>标题</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payload.data.map((review) => (
            <TableRow key={review.id}>
              <TableCell>{review.airportName}</TableCell>
              <TableCell>{review.rating}</TableCell>
              <TableCell>{review.title}</TableCell>
              <TableCell>{review.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
