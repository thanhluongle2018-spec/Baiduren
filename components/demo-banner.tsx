import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/config";

export function DemoBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <Badge
        variant="outline"
        className="mt-0.5 border-amber-300 bg-white text-amber-800"
      >
        {siteConfig.demoNotice}
      </Badge>
      <p>{message ?? siteConfig.rankingNotice}</p>
    </div>
  );
}
