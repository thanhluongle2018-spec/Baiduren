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
import { reviews } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "评价管理",
};

export default function AdminReviewsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Review 管理"
        description="占位列表。后续可在此审核评价状态：PENDING / PUBLISHED / HIDDEN。"
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
          {reviews.map((review) => (
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
