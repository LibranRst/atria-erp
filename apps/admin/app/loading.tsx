import { Skeleton } from "@heroui/react";

export default function Loading(): React.JSX.Element {
  return (
    <div role="status" aria-label="Memuat Admin" className="space-y-6 p-6">
      <Skeleton animationType="none" className="h-6 w-40" />
      <div className="flex gap-4">
        <Skeleton animationType="none" className="h-9 w-64" />
        <Skeleton animationType="none" className="h-9 w-28" />
      </div>
      <div className="space-y-3 rounded-xl bg-surface p-5">
        <Skeleton animationType="none" className="h-7 w-full" />
        {Array.from({ length: 5 }, (_, index): React.JSX.Element => (
          <Skeleton key={index} animationType="none" className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
