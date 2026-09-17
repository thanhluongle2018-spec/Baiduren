import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await pingDatabase();
  return NextResponse.json({
    ok: database === "connected",
    service: "baiduren",
    database,
  });
}
