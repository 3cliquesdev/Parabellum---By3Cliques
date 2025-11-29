import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600",
        // Enterprise Subtle Variants
        success: "border-emerald-200/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
        warning: "border-amber-200/20 bg-amber-500/10 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
        info: "border-blue-200/20 bg-blue-500/10 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400",
        error: "border-rose-200/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400",
        // Gamification Subtle
        hot: "border-orange-200/20 bg-orange-500/10 text-orange-500 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400",
        cold: "border-slate-200/20 bg-slate-500/10 text-slate-500 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
