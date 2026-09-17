const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "等待中";
    case "QUEUED":
      return "排队中";
    case "RUNNING":
      return "测速中";
    case "SUCCESS":
    case "COMPLETED":
      return "成功";
    case "FAILED":
      return "失败";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
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
