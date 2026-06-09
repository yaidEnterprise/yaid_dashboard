import { cn } from "@/utils/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} />;
}

export function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <Bone className="h-3 w-24" />
            <Bone className="h-8 w-8" />
          </div>
          <Bone className="mt-4 h-8 w-16" />
          <Bone className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col} className="px-6 py-3.5">
              <Bone className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
