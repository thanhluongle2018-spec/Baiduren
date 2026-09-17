"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/ranking", label: "排行榜" },
  { href: "/admin", label: "后台" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="size-7" />
          <span className="text-base font-semibold tracking-tight">
            {siteConfig.name}
          </span>
          <Badge
            variant="outline"
            className="hidden border-amber-300 bg-amber-50 text-amber-800 sm:inline-flex"
          >
            {siteConfig.demoNotice}
          </Badge>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={buttonVariants({ variant: "ghost", size: "icon" }) + " md:hidden"}
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <nav className="border-t px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-sm hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
