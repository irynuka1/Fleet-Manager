import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-card overflow-hidden",
        className
      )}
    >
      {/* Table header */}
      <div className="border-b bg-muted/50 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={i}
              className="h-4 flex-1 animate-shimmer rounded bg-muted"
            />
          ))}
        </div>
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "flex gap-4 px-4 py-3",
            rowIndex < rows - 1 && "border-b"
          )}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 flex-1 animate-shimmer rounded bg-muted"
              style={{ animationDelay: `${(rowIndex * cols + colIndex) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 shadow-sm",
        className
      )}
    >
      <div className="space-y-3">
        <div className="h-4 w-1/3 animate-shimmer rounded bg-muted" />
        <div className="h-8 w-1/2 animate-shimmer rounded bg-muted" />
        <div className="h-4 w-2/3 animate-shimmer rounded bg-muted" />
      </div>
    </div>
  );
}

interface StatsSkeletonProps {
  count?: number;
  className?: string;
}

export function StatsSkeleton({ count = 3, className }: StatsSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-6",
        count === 2 && "grid-cols-1 sm:grid-cols-2",
        count === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        count >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div
                className="h-4 w-24 animate-shimmer rounded bg-muted"
                style={{ animationDelay: `${i * 100}ms` }}
              />
              <div
                className="h-8 w-20 animate-shimmer rounded bg-muted"
                style={{ animationDelay: `${i * 100 + 50}ms` }}
              />
            </div>
            <div
              className="h-12 w-12 animate-shimmer rounded-xl bg-muted"
              style={{ animationDelay: `${i * 100 + 75}ms` }}
            />
          </div>
          <div
            className="mt-3 h-4 w-32 animate-shimmer rounded bg-muted"
            style={{ animationDelay: `${i * 100 + 100}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
