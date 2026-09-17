const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatLatency(ms: number) {
  return `${ms.toFixed(0)} ms`;
}

export function formatSpeed(mbps: number) {
  return `${mbps.toFixed(1)} Mbps`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatScore(value: number) {
  return value.toFixed(1);
}

export function formatPrice(price: number, cycle: string) {
  const cycleLabel =
    cycle === "yearly" ? "年" : cycle === "quarterly" ? "季" : "月";
  return `¥${price.toFixed(0)} / ${cycleLabel}`;
}
