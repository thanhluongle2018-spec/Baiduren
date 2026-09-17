import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="22"
        width="26"
        height="2.2"
        rx="1"
        className="fill-primary"
      />
      <path
        d="M7 20.5h18l-2.4 5.2H9.4L7 20.5Z"
        className="fill-primary/15 stroke-primary"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M16 6v11.5"
        className="stroke-primary"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="5.2" r="2.1" className="fill-primary" />
    </svg>
  );
}

export function AirportLogo({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
    >
      {text}
    </span>
  );
}
