import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin-page-header";
import { StatCard } from "@/components/stat-card";
import { listAirports } from "@/lib/data/airports";
import {
  listAnnouncements,
  listPromotions,
  listReviews,
  listSpeedTests,
} from "@/lib/data/content";

export const metadata: Metadata = {
  title: "后台总览",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [airports, tests, reviewList, promoList, announcementList] =
    await Promise.all([
      listAirports(),
      listSpeedTests(),
      listReviews(),
      listPromotions(),
      listAnnouncements(),
    ]);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="只读计数。尚未接入登录与 CRUD，数据来自 PostgreSQL 或演示回退。"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="机场" value={String(airports.data.length)} />
        <StatCard label="测速记录" value={String(tests.data.length)} />
        <StatCard label="评价" value={String(reviewList.data.length)} />
        <StatCard label="推广" value={String(promoList.data.length)} />
        <StatCard label="公告" value={String(announcementList.data.length)} />
      </div>
    </div>
  );
}
