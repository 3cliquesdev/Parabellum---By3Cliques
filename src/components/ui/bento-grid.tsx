import * as React from "react";
import { cn } from "@/lib/utils";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  span?: "1" | "2" | "3" | "4" | "full";
  rowSpan?: "1" | "2";
}

export function BentoGrid({ children, className, cols = 4 }: BentoGridProps) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid gap-3 lg:gap-3 xl:gap-4 auto-rows-min",
        colsClass[cols],
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({ children, className, span = "1", rowSpan = "1" }: BentoCardProps) {
  const spanClass = {
    "1": "col-span-1",
    "2": "col-span-1 sm:col-span-2 lg:col-span-2",
    "3": "col-span-1 sm:col-span-2 lg:col-span-3",
    "4": "col-span-full lg:col-span-4",
    "full": "col-span-full",
  };

  const rowSpanClass = {
    "1": "",
    "2": "row-span-2",
  };

  return (
    <div className={cn(spanClass[span], rowSpanClass[rowSpan], "min-w-0", className)}>
      {children}
    </div>
  );
}
