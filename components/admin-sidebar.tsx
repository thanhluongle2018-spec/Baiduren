"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  Landmark,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Timer,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "总览", icon: Gauge },
  { href: "/admin/airports", label: "机场管理", icon: Landmark },
  { href: "/admin/speed-tests", label: "测速管理", icon: Timer },
  { href: "/admin/reviews", label: "评价管理", icon: MessageSquare },
  { href: "/admin/promotions", label: "推广管理", icon: MousePointerClick },
  { href: "/admin/announcements", label: "公告管理", icon: Megaphone },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b bg-card md:w-56 md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 py-4">
        <BrandMark className="size-6" />
        <div>
          <p className="text-sm font-semibold">摆渡人后台</p>
          <p className="text-xs text-muted-foreground">占位 · 无权限系统</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible md:pb-6">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
