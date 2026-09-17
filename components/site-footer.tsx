import Link from "next/link";
import { siteConfig } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-semibold">{siteConfig.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>
        <div>
          <p className="text-sm font-medium">页面</p>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              首页
            </Link>
            <Link href="/ranking" className="hover:text-foreground">
              排行榜
            </Link>
            <Link href="/admin" className="hover:text-foreground">
              后台
            </Link>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>当前为演示站点。</p>
          <p className="mt-1">不提供代理连接，不展示真实节点配置，不接入真实推广链接。</p>
        </div>
      </div>
    </footer>
  );
}
