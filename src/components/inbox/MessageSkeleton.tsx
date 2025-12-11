import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageSkeletonProps {
  count?: number;
}

export function MessageSkeleton({ count = 5 }: MessageSkeletonProps) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => {
        const isCustomer = i % 2 === 0;
        return (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              isCustomer ? "justify-start" : "justify-end"
            )}
          >
            {isCustomer && (
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            )}
            
            <div className={cn("flex flex-col gap-1", isCustomer ? "items-start" : "items-end")}>
              {!isCustomer && (
                <Skeleton className="h-3 w-20" />
              )}
              <Skeleton 
                className={cn(
                  "h-16 rounded-2xl",
                  isCustomer ? "rounded-tl-none w-48" : "rounded-tr-none w-56"
                )} 
              />
              <Skeleton className="h-2 w-12" />
            </div>
            
            {!isCustomer && (
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-full max-w-[200px]" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ContactDetailsSkeleton() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      
      {/* Info Cards */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      
      {/* Tags */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
      
      {/* Timeline */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
