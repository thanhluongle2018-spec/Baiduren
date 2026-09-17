import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { AirportPlan } from "@/types";

export function PlanList({ plans }: { plans: AirportPlan[] }) {
  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无演示套餐。</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => (
        <Card key={plan.id} size="sm">
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatPrice(plan.price, plan.billingCycle)}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              流量 {plan.trafficGb ?? "—"} GB · 设备 {plan.deviceLimit ?? "—"}
            </p>
            <div className="flex flex-wrap gap-1">
              {plan.features.map((feature) => (
                <Badge key={feature} variant="secondary">
                  {feature}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
