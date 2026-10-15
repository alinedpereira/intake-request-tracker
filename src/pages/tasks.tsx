import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskCard, TaskDialog } from "@/components/task-bits";
import { useAppStore } from "@/lib/store";
import { odataString } from "@/lib/intake";
import { OWNED_REQUEST_CAP, taskStatusOf, useAssigneeTaskScope, useTaskPage, useTaskStatuses } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TasksPage() {
  const role = useAppStore((s) => s.role);
  if (role === "Requestor")
    return (
      <div className="p-8">
        <EmptyState icon={Lock} title="Tasks are only available to assignees and managers" />
      </div>
    );
  if (role === "Assignee") return <AssigneeTasks />;
  return <TasksBoard />;
}

/** Assignee view: only tasks Assigned To them, or on requests they Own. */
function AssigneeTasks() {
  const me = useAppStore((s) => s.me);
  const [adding, setAdding] = useState(false);
  const { owned, filter, partial } = useAssigneeTaskScope(me?.Email || undefined);
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
        {me?.Email && (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> New task
          </Button>
        )}
      </div>
      {!me?.Email ? (
        <EmptyState
          icon={ListChecks}
          title="Pick yourself as Owner on My requests to see your tasks"
          action={<Button asChild variant="outline"><Link to="/">Go to My requests</Link></Button>}
        />
      ) : owned.isPending ? (
        <LoadingState rows={4} />
      ) : owned.isError ? (
        <ErrorState title="Your tasks could not be loaded" action={<Button onClick={() => void owned.refetch()}>Retry</Button>} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Tasks assigned to you and tasks on requests you own.
            {partial ? ` Only your ${OWNED_REQUEST_CAP} most recent owned requests are included.` : ""}
          </p>
          <Board key={filter} filter={filter} />
        </>
      )}
      {adding && <TaskDialog open onOpenChange={setAdding} />}
    </div>
  );
}

function TasksBoard() {
  const me = useAppStore((s) => s.me);
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [adding, setAdding] = useState(false);
  const filter = scope === "mine" && me?.Email ? `AssignedTo/EMail eq ${odataString(me.Email)}` : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Show" className="inline-flex rounded-md border border-border bg-card p-0.5">
            {(["mine", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                disabled={s === "mine" && !me?.Email}
                onClick={() => setScope(s)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                  scope === s ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                {s === "mine" ? "My tasks" : "All tasks"}
              </button>
            ))}
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> New task
          </Button>
        </div>
      </div>
      {!me?.Email && <p className="text-sm text-muted-foreground">Pick yourself on My requests to filter to your own tasks.</p>}
      <Board key={filter ?? "all"} filter={filter} />
      {adding && <TaskDialog open onOpenChange={setAdding} />}
    </div>
  );
}

function Board({ filter }: { filter: string | undefined }) {
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const q = useTaskPage(filter, skipToken);
  const statuses = useTaskStatuses();
  const rows = q.data?.rows ?? [];
  const nextToken = q.data?.nextToken;

  if (q.isPending || statuses.isPending) return <LoadingState rows={4} />;
  if (q.isError || statuses.isError)
    return <ErrorState title="Tasks could not be loaded" action={<Button onClick={() => { void q.refetch(); void statuses.refetch(); }}>Retry</Button>} />;
  if (rows.length === 0 && prev.length === 0 && !nextToken)
    return <EmptyState icon={ListChecks} title="No tasks yet" description="Add a task to break a request into internal work." />;

  const columns = statuses.data;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const items = rows.filter((t) => taskStatusOf(t) === col);
          return (
            <section key={col} aria-labelledby={`col-${col}`} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3">
              <h2 id={`col-${col}`} className="flex items-center justify-between text-sm font-semibold">
                {col}
                <span className="rounded-full bg-card px-2 py-0.5 text-xs">{items.length}</span>
              </h2>
              {items.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">None</p> : items.map((t) => <TaskCard key={t.ID} task={t} />)}
            </section>
          );
        })}
      </div>
      {(prev.length > 0 || nextToken) && (
        <div className="flex items-center justify-end gap-2">
          <p className="mr-auto text-sm text-muted-foreground">Showing {rows.length} tasks on this page.</p>
          {prev.length > 0 && (
            <Button variant="outline" disabled={q.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>Previous page</Button>
          )}
          {nextToken && (
            <Button disabled={q.isFetching} onClick={() => { setPrev((p) => [...p, skipToken]); setSkipToken(nextToken); }}>
              {q.isFetching ? "Loading…" : "Next page"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
