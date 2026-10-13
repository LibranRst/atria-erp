import { Skeleton } from "@/components/ui";

export function ProjectSkeleton({
  detail = false,
}: {
  readonly detail?: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat proyek">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      {detail ? (
        <div className="rounded-xl bg-surface p-5">
          <Skeleton className="mb-6 h-5 w-36" />
          <div className="grid grid-cols-3 gap-5 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index}>
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-44" />
        </div>
      )}
      <div className="rounded-xl bg-surface p-4">
        <Skeleton className="mb-4 h-9 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="my-4 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
