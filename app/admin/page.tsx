import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatCard } from "@/components/stat-card";
import {
  airports,
  announcements,
  promotions,
  reviews,
  speedTests,
} from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "后台总览",
};

export default function AdminDashboardPage() {
  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="第一阶段只展示模块入口和演示计数，不连接真实业务数据。"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="机场" value={String(airports.length)} />
        <StatCard label="测速记录" value={String(speedTests.length)} />
        <StatCard label="评价" value={String(reviews.length)} />
        <StatCard label="推广" value={String(promotions.length)} />
        <StatCard label="公告" value={String(announcements.length)} />
      </div>
    </div>
  );
}
