import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PriorityText, StatusPill } from "@/components/request-bits";
import { ChoiceSelect } from "@/components/choice-select";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { formatDate, isOverdue, requestNumber, statusOf, useRequestPage } from "@/lib/intake";
import { taskStatusOf, useTaskPage } from "@/lib/tasks";
import { ownerNames, requestorOf, useMyRequestScope } from "@/lib/people";

const PAGE = 50;
const TASK_SCAN = 1000;

/** Request list for the "Request & tasks" screen: all requests for managers, assigned ones for assignees. */
export function WorkRequestList() {
  const role = useAppStore((s) => s.role);
  const isManager = role === "Manager";
  const { needsIdentity, filter } = useMyRequestScope();
  const heading = isManager ? "All requests" : "Requests assigned to me";

  if (needsIdentity)
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <EmptyState icon={ClipboardCheck} title="Pick yourself as Owner on My requests to see your assigned requests" action={<Button asChild variant="outline"><Link to="/">Go to My requests</Link></Button>} />
      </>
    );
  return <ListBody key={filter ?? "all"} filter={filter} heading={heading} />;
}

function ListBody({ filter, heading }: { filter: string | undefined; heading: string }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const q = useRequestPage(filter, skipToken, PAGE);
  const tasks = useTaskPage(undefined, undefined, TASK_SCAN);
  const all = q.data?.rows ?? [];
  const rows = status ? all.filter((r) => statusOf(r) === status) : all;
  const nextToken = q.data?.nextToken;
  const paged = prev.length > 0 || !!nextToken;

  const taskCounts = new Map<number, { done: number; total: number }>();
  for (const t of tasks.data?.rows ?? []) {
    if (!t.RequestItemId) continue;
    const c = taskCounts.get(t.RequestItemId) ?? { done: 0, total: 0 };
    c.total += 1;
    if (taskStatusOf(t) === "Done") c.done += 1;
    taskCounts.set(t.RequestItemId, c);
  }
  const tasksPartial = !!tasks.data?.nextToken;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {heading}
          {q.isSuccess && <span> ({rows.length})</span>}
        </h1>
        <div className="grid w-60 gap-1">
          <Label htmlFor="work-status">Filter by status</Label>
          <ChoiceSelect id="work-status" field="Status" value={status} onChange={setStatus} placeholder="All statuses" />
        </div>
      </div>

      {q.isPending ? (
        <LoadingState rows={6} />
      ) : q.isError ? (
        <ErrorState title="Requests could not be loaded" action={<Button onClick={() => void q.refetch()}>Retry</Button>} />
      ) : all.length === 0 && prev.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No requests yet" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">{heading}{status ? `, filtered to ${status}` : ""}</caption>
              <thead className="bg-accent text-left text-accent-foreground">
                <tr>
                  {["Intake #", "Request title", "Status", "Priority", "Requestor", "Owner", "Needed by", "Tasks done"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const c = r.ID ? taskCounts.get(r.ID) : undefined;
                  return (
                    <tr key={r.ID} onClick={() => navigate(`/work/${r.ID}`)} className="cursor-pointer hover:bg-muted/60">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link to={`/work/${r.ID}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                          {requestNumber(r)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.Title}</td>
                      <td className="px-4 py-3"><StatusPill status={statusOf(r)} /></td>
                      <td className="px-4 py-3"><PriorityText priority={r.Priority?.Value} /></td>
                      <td className="px-4 py-3">{requestorOf(r) ?? "—"}</td>
                      <td className="px-4 py-3">{ownerNames(r) ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(r.NeededBy)}
                        {isOverdue(r) && <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-400">Overdue</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {tasks.isPending ? "…" : tasks.isError ? "—" : c ? `${c.done} of ${c.total}` : "None"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No requests with this status{paged ? " on this page" : ""}.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm italic text-muted-foreground">
              Click any row to open the request with its tasks.
              {paged ? " The count covers this page." : ""}
              {tasks.isError ? " Task counts could not be loaded." : tasksPartial ? ` Task counts cover the latest ${TASK_SCAN} tasks.` : ""}
            </p>
            {paged && (
              <div className="flex gap-2">
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
          </div>
        </>
      )}
    </>
  );
}
