import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ChoiceSelect } from "@/components/choice-select";
import { useAppStore } from "@/lib/store";
import { REJECTED, formatDate, requestNumber, statusOf, useRequestPage } from "@/lib/intake";
import { ownerNames, requestorOf, useMyRequestScope } from "@/lib/people";
import { cn } from "@/lib/utils";

const LIST_PAGE = 200;

function statusTone(s: string) {
  if (s === "Closed") return "text-emerald-800 dark:text-emerald-300";
  if (s === REJECTED) return "text-red-700 dark:text-red-400";
  if (s === "In Progress") return "text-amber-800 dark:text-amber-300";
  if (s === "Assigned / Under Review" || s === "Requirements sign-off" || s === "Acceptance sign-off") return "text-violet-800 dark:text-violet-300";
  return "text-sky-800 dark:text-sky-300";
}

function priorityTone(p?: string) {
  if (p === "High" || p === "Critical") return "text-red-700 dark:text-red-400";
  if (p === "Medium") return "text-sky-800 dark:text-sky-300";
  return "text-foreground";
}

export function MyIntakesPage() {
  const role = useAppStore((s) => s.role);
  const { needsIdentity, filter } = useMyRequestScope();
  const heading = role === "Requestor" ? "My intakes" : role === "Assignee" ? "Intakes assigned to me" : "All intakes";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5 md:p-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to my requests
      </Link>
      {needsIdentity ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <EmptyState
            icon={ClipboardList}
            title={role === "Assignee" ? "Pick yourself as Owner on My requests first" : "Pick yourself as Requestor on My requests first"}
            action={<Button asChild variant="outline"><Link to="/">Go to My requests</Link></Button>}
          />
        </>
      ) : (
        <IntakeTable key={filter ?? "all"} filter={filter} heading={heading} showRequestor={role !== "Requestor"} />
      )}
    </div>
  );
}

function IntakeTable({ filter, heading, showRequestor }: { filter: string | undefined; heading: string; showRequestor: boolean }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const q = useRequestPage(filter, skipToken, LIST_PAGE);
  const all = q.data?.rows ?? [];
  const nextToken = q.data?.nextToken;
  const rows = status ? all.filter((r) => statusOf(r) === status) : all;
  const paged = prev.length > 0 || !!nextToken;
  const open = (id?: number) => id && navigate(`/requests/${id}`, { state: { from: "/intakes" } });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid w-64 gap-1">
          <Label htmlFor="status-filter">Filter by status</Label>
          <ChoiceSelect id="status-filter" field="Status" value={status} onChange={setStatus} placeholder="All statuses" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {heading}
          {q.isSuccess && <span> ({rows.length})</span>}
        </h1>
      </div>

      {q.isPending ? (
        <LoadingState rows={5} />
      ) : q.isError ? (
        <ErrorState title="Intakes could not be loaded" action={<Button onClick={() => void q.refetch()}>Retry</Button>} />
      ) : all.length === 0 && prev.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No intakes yet" action={<Button asChild><Link to="/new">Submit a request</Link></Button>} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{heading}{status ? `, filtered to ${status}` : ""}</caption>
              <thead className="bg-accent text-left text-accent-foreground">
                <tr>
                  {["Intake #", "Request title", "Priority", "Status", ...(showRequestor ? ["Requestor"] : []), "Owner", "Reference", "Updated"].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.ID} onClick={() => open(r.ID)} className="cursor-pointer hover:bg-muted/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/requests/${r.ID}`}
                        state={{ from: "/intakes" }}
                        onClick={(e) => e.stopPropagation()}
                        className="whitespace-nowrap text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {requestNumber(r)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.Title}</td>
                    <td className={cn("px-4 py-3 font-semibold", priorityTone(r.Priority?.Value))}>{r.Priority?.Value ?? "—"}</td>
                    <td className={cn("px-4 py-3 font-semibold", statusTone(statusOf(r)))}>{statusOf(r)}</td>
                    {showRequestor && <td className="px-4 py-3">{requestorOf(r) ?? "—"}</td>}
                    <td className="px-4 py-3">{ownerNames(r) ?? "Unassigned"}</td>
                    <td className="px-4 py-3">{r.Reference || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(r.Modified ?? r.Created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No intakes with this status{paged ? " on this page" : ""}.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm italic text-muted-foreground">
              Click any row to open the request and its status.{paged ? " The count covers this page." : ""}
            </p>
            {paged && (
              <div className="flex gap-2">
                {prev.length > 0 && (
                  <Button variant="outline" disabled={q.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>
                    Previous page
                  </Button>
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
