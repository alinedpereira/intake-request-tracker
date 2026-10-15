import { cn } from "@/lib/utils";
import { REJECTED } from "@/lib/intake";

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Closed"
      ? "bg-emerald-700 text-white"
      : status === REJECTED
        ? "bg-red-700 text-white"
        : status === "In Progress"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50"
          : status === "Submitted" || status === "Queued"
            ? "bg-muted text-foreground"
            : "bg-accent text-accent-foreground";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>{status}</span>;
}

export function PriorityText({ priority }: { priority?: string }) {
  if (!priority) return <span className="text-muted-foreground">Not set</span>;
  const strong = priority === "High" || priority === "Critical";
  return <span className={cn(strong && "font-semibold", priority === "Critical" && "text-red-700 dark:text-red-400")}>{priority}</span>;
}
