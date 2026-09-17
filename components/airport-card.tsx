import Link from "next/link";
import { AirportLogo } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScore } from "@/lib/format";
import type { AirportSummary } from "@/types";

export function AirportCard({ airport }: { airport: AirportSummary }) {
  return (
    <Link href={`/airports/${airport.slug}`} className="block h-full">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="flex flex-row items-start gap-3">
          <AirportLogo text={airport.logoText} />
          <div className="min-w-0">
            <CardTitle className="truncate">{airport.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              综合评分 {formatScore(airport.score)}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto border-amber-300 text-amber-800">
            演示
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">{airport.summary}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
