import { airports, getAirportBySlug } from "@/lib/demo-data";
import type { AirportDetail, AirportSummary } from "@/types";

export async function listAirports(): Promise<AirportSummary[]> {
  return airports;
}

export async function getAirportDetail(
  slug: string
): Promise<AirportDetail | undefined> {
  return getAirportBySlug(slug);
}
