import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { ReviewRecord } from "@/types";

export function ReviewList({ records }: { records: ReviewRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无演示评价。</p>;
  }

  return (
    <div className="grid gap-3">
      {records.map((review) => (
        <Card key={review.id} size="sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>{review.title}</CardTitle>
            <Badge variant="outline">{review.rating} / 5</Badge>
            <Badge variant="outline" className="border-amber-300 text-amber-800">
              演示评价
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">{review.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {review.authorLabel} · {formatDateTime(review.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
