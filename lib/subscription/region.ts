import type { RegionHint } from "@/lib/subscription/types";

const RULES: Array<{ hint: RegionHint; pattern: RegExp }> = [
  { hint: "HK", pattern: /香港|hong\s*kong|\bhk\b/i },
  { hint: "TW", pattern: /台灣|台湾|\btw\b|taiwan/i },
  { hint: "JP", pattern: /日本|\bjp\b|japan|东京|大阪|名古屋/i },
  { hint: "SG", pattern: /新加坡|\bsg\b|singapore/i },
  { hint: "US", pattern: /美国|美國|\busa\b|\bus\b|united\s*states|洛杉矶|硅谷|california|\bus-west\b/i },
];

export function inferRegionHint(name: string): RegionHint {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.hint;
  }
  return "UNKNOWN";
}

export function regionLabel(hint: RegionHint) {
  switch (hint) {
    case "HK":
      return "香港";
    case "JP":
      return "日本";
    case "US":
      return "美国";
    case "TW":
      return "台湾";
    case "SG":
      return "新加坡";
    default:
      return "未知";
  }
}
