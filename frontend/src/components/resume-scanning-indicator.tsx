"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A small "scan-line" animation styled like a document being scanned —
 * used in place of a generic spinner anywhere we're actively analyzing a resume.
 */
export function ResumeScanningIndicator({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const dims = size === "sm" ? "h-4 w-3.5" : "h-9 w-7";
  const lineGap = size === "sm" ? "gap-[2px] top-[3px]" : "gap-1 top-1.5";
  const lineHeight = size === "sm" ? "h-px" : "h-0.5";
  const travel = size === "sm" ? 12 : 30;

  return (
    <div
      role="status"
      aria-label="Analyzing resume"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[3px] border border-primary/40 bg-primary/5",
        dims,
        className
      )}
    >
      <div className={cn("absolute inset-x-1 flex flex-col", lineGap)}>
        <span className={cn("w-full rounded-full bg-primary/30", lineHeight)} />
        <span className={cn("w-2/3 rounded-full bg-primary/30", lineHeight)} />
        <span className={cn("w-full rounded-full bg-primary/30", lineHeight)} />
      </div>
      {prefersReducedMotion ? (
        <div className="absolute inset-0 animate-pulse bg-primary/15" />
      ) : (
        <motion.div
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ y: [0, travel, 0] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
