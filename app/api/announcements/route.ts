import { NextResponse } from "next/server";
import { announcements } from "@/lib/demo-data";
import type { ApiListResponse } from "@/types/api";
import type { AnnouncementRecord } from "@/types";

export function GET() {
  const body: ApiListResponse<AnnouncementRecord[]> = {
    demo: true,
    source: "demo",
    generatedAt: new Date().toISOString(),
    data: announcements,
  };
  return NextResponse.json(body);
}
