import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states";
import { TaskDialog, TaskStatusSelect } from "@/components/task-bits";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDate, odataString, type IntakeRequest } from "@/lib/intake";
import { useAppStore } from "@/lib/store";
import { isTaskOverdue, taskAssigneeName, taskStatusOf, updateTask, useTaskPage, type IntakeTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Full-width section listing every task linked to one request (assignees and managers only). */
export function RequestTaskPanel({ request }: { request: IntakeRequest }) {
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<IntakeTask | null>(null);
  const qc = useQueryClient();
  const role = useAppStore((s) => s.role);
  const me = useAppStore((s) => s.me);
  // Assignees see every task on requests they own; on other requests, only tasks assigned to them.
  const ownsRequest = !!me?.Email && request.Owner?.Email?.toLowerCase() === me.Email.toLowerCase();
  const assigneeLimited = role === "Assignee" && !ownsRequest;
  const base = `RequestItemId eq ${Number(request.ID)}`;
  const filter = assigneeLimited
    ? me?.Email
      ? `${base} and AssignedTo/EMail eq ${odataString(me.Email)}`
      : `${base} and ID eq 0`
    : base;
  const q = useTaskPage(filter, skipToken, 100);
  const rows = q.data?.rows ?? [];
  const nextToken = q.data?.nextToken;
  const paged = prev.length > 0 || !!nextToken;
  const doneCount = rows.filter((t) => taskStatusOf(t) === "Done").length;

  const setStatus = useMutation({
    mutationFn: ({ id, v }: { id: number; v: string }) => updateTask(id, { TaskStatus: { Value: v } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("The task could not be saved. Please try again."),
  });

  return (
    <section aria-labelledby="req-tasks-h" className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-primary bg-accent px-4 py-2.5 text-accent-foreground">
        <h2 id="req-tasks-h" className="font-semibold">
          {assigneeLimited ? "Your tasks on this request" : "Tasks for this request"}
          {q.isSuccess && rows.length > 0 && (
            <span className="ml-2 text-sm font-normal">
              {doneCount} of {rows.length} done{paged ? " on this page" : ""}
            </span>
          )}
        </h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add task
        </Button>
      </div>
      {q.isSuccess && rows.length > 0 && (
        <div className="h-2 bg-muted" aria-hidden="true">
          <div className="h-full bg-emerald-700" style={{ width: `${(doneCount / rows.length) * 100}%` }} />
        </div>
      )}
      <div className="p-4">
        {q.isPending ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : q.isError ? (
          <ErrorState className="py-6" title="Tasks could not be loaded" action={<Button size="sm" onClick={() => void q.refetch()}>Retry</Button>} />
        ) : rows.length === 0 && prev.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks for this request yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Tasks for {request.Title}</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Task</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Assigned to</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Due</th>
                  <th scope="col" className="w-48 py-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Notes</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((t) => {
                  const st = taskStatusOf(t);
                  const overdue = isTaskOverdue(t);
                  return (
                    <tr key={t.ID} className="align-top">
                      <td className={cn("py-2.5 pr-4 font-semibold", st === "Done" && "line-through")}>{t.Title}</td>
                      <td className="py-2.5 pr-4">{taskAssigneeName(t) ?? "Unassigned"}</td>
                      <td className={cn("whitespace-nowrap py-2.5 pr-4", overdue && "font-semibold text-red-700 dark:text-red-400")}>
                        {t.DueDate ? formatDate(t.DueDate) : "—"}
                        {overdue && " · overdue"}
                      </td>
                      <td className="py-2 pr-4">
                        <TaskStatusSelect
                          id={`rt-status-${t.ID}`}
                          label={`Status of ${t.Title}`}
                          value={st}
                          onChange={(v) => v !== st && setStatus.mutate({ id: t.ID as number, v })}
                        />
                      </td>
                      <td className="max-w-xs py-2.5 pr-4 text-muted-foreground"><p className="line-clamp-2 whitespace-pre-wrap">{t.TaskNotes || "—"}</p></td>
                      <td className="py-1.5">
                        <Button variant="ghost" size="icon" aria-label={`Edit task ${t.Title}`} onClick={() => setEditing(t)}>
                          <Pencil aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {paged && (
              <div className="mt-3 flex justify-end gap-2">
                {prev.length > 0 && <Button size="sm" variant="outline" disabled={q.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>Previous page</Button>}
                {nextToken && <Button size="sm" disabled={q.isFetching} onClick={() => { setPrev((p) => [...p, skipToken]); setSkipToken(nextToken); }}>Next page</Button>}
              </div>
            )}
          </div>
        )}
      </div>
      {adding && <TaskDialog open onOpenChange={setAdding} request={request} />}
      {editing && <TaskDialog open onOpenChange={(o) => !o && setEditing(null)} task={editing} />}
    </section>
  );
}
