import { SVGProps } from "react";

import { cn } from "@/lib/utils";

export function OpencelLogo({
  size = 20,
  className,
  ...rest
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(className)}
      {...rest}
    >
      <path d="M3 12h4l3 -8 4 16 3 -8h4" />
    </svg>
  );
}
