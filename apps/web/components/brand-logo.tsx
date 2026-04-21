import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /**
   * Height in px. Width scales automatically with the viewBox.
   */
  size?: number;
  /**
   * `mark` renders only the logomark. `full` renders mark + wordmark.
   */
  variant?: "mark" | "full";
  className?: string;
};

/**
 * OpenCel logomark — a stylized "C" formed by two offset arcs, paired with
 * a small spark to suggest deployment / motion. Uses the brand gradient.
 */
export function BrandLogo({
  size = 22,
  variant = "mark",
  className,
}: BrandLogoProps) {
  const gradId = "opencel-brand-gradient";
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
    >
      <svg
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="hsl(var(--brand-from))" />
            <stop offset="100%" stopColor="hsl(var(--brand-to))" />
          </linearGradient>
        </defs>
        {/* Outer C arc */}
        <path
          d="M28 8.5A12 12 0 1 0 28 23.5"
          stroke={`url(#${gradId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Inner accent arc (offset) */}
        <path
          d="M23 13A7 7 0 1 0 23 19"
          stroke="hsl(var(--foreground))"
          strokeOpacity="0.85"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Spark */}
        <circle cx="26" cy="16" r="2" fill={`url(#${gradId})`} />
      </svg>
      {variant === "full" && (
        <span className="text-[15px] font-semibold tracking-tight">
          OpenCel
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
