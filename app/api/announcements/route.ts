import { NextResponse } from "next/server";
import { listAnnouncements } from "@/lib/data/content";
import type { ApiListResponse } from "@/types/api";
import type { AnnouncementRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await listAnnouncements();
  const body: ApiListResponse<AnnouncementRecord[]> = {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
