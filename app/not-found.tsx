import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-start justify-center px-4 py-24">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">页面不存在</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        该路径没有对应页面，或演示机场 slug 不正确。
      </p>
      <Link href="/" className={`${buttonVariants()} mt-6`}>
        返回首页
      </Link>
    </div>
  );
}
