import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, FilePlus2, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PriorityText, StatusPill } from "@/components/request-bits";
import { useAppStore } from "@/lib/store";
import { formatDate, isOverdue, requestNumber, statusOf, useRequestPage } from "@/lib/intake";
import { ownerNames, requestorOf, useMyRequestScope } from "@/lib/people";
import { PersonPicker } from "@/components/person-picker";

export function HomePage() {
  const role = useAppStore((s) => s.role);
  const me = useAppStore((s) => s.me);
  const setMe = useAppStore((s) => s.setMe);
  const { needsIdentity, filter } = useMyRequestScope();

  const heading = role === "Requestor" ? "My requests" : role === "Assignee" ? "Assigned to me" : "All requests";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          {!needsIdentity && (
            <Button asChild variant="outline" size="sm">
              <Link to="/intakes">
                <TableProperties aria-hidden="true" /> Intake list
              </Link>
            </Button>
          )}
        </div>
        {role !== "Manager" && (
          <div className="grid w-80 gap-1">
            <Label htmlFor="my-person">{role === "Assignee" ? "Owner" : "Requestor"}</Label>
            <PersonPicker id="my-person" field={role === "Assignee" ? "Owner" : "Requestor"} value={me} onChange={setMe} />
          </div>
        )}
      </div>

      {needsIdentity ? (
        <EmptyState
          icon={ClipboardList}
          title={role === "Assignee" ? "Pick yourself as Owner to see your assignments" : "Pick yourself as Requestor to see your requests"}
          action={
            role === "Requestor" ? (
              <Button asChild variant="outline">
                <Link to="/new">
                  <FilePlus2 aria-hidden="true" /> Start a new request
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RequestPages key={filter ?? "all"} filter={filter} role={role} />
      )}
    </div>
  );
}

function RequestPages({ filter, role }: { filter: string | undefined; role: string }) {
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const query = useRequestPage(filter, skipToken);
  const rows = query.data?.rows ?? [];
  const nextToken = query.data?.nextToken;

  if (query.isPending) return <LoadingState rows={5} />;
  if (query.isError)
    return (
      <ErrorState
        title="Requests could not be loaded"
        action={
          <div className="flex gap-2">
            {prev.length > 0 && (
              <Button variant="outline" onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>
                Previous page
              </Button>
            )}
            <Button onClick={() => void query.refetch()}>Retry</Button>
          </div>
        }
      />
    );
  if (prev.length === 0 && rows.length === 0 && !nextToken)
    return (
      <EmptyState
        icon={ClipboardList}
        title={role === "Assignee" ? "Nothing is assigned to you yet" : "No requests yet"}
        action={
          role !== "Assignee" ? (
            <Button asChild>
              <Link to="/new">Submit a request</Link>
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Requests</caption>
          <thead className="bg-muted/70 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Request</th>
              <th scope="col" className="px-4 py-3 font-semibold">Routed to</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Priority</th>
              <th scope="col" className="px-4 py-3 font-semibold">Needed by</th>
              {role !== "Requestor" && <th scope="col" className="px-4 py-3 font-semibold">Requestor</th>}
              {role === "Manager" && <th scope="col" className="px-4 py-3 font-semibold">Owner</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.ID} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link to={`/requests/${r.ID}`} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    {r.Title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{requestNumber(r)}</div>
                </td>
                <td className="px-4 py-3">{r.RoutedTeam?.Value ?? "—"}</td>
                <td className="px-4 py-3"><StatusPill status={statusOf(r)} /></td>
                <td className="px-4 py-3"><PriorityText priority={r.Priority?.Value} /></td>
                <td className="px-4 py-3">
                  {formatDate(r.NeededBy)}
                  {isOverdue(r) && <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-400">Overdue</span>}
                </td>
                {role !== "Requestor" && <td className="px-4 py-3">{requestorOf(r) ?? "—"}</td>}
                {role === "Manager" && <td className="px-4 py-3">{ownerNames(r) ?? <span className="text-muted-foreground">Unassigned</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No requests on this page.</p>}
      </div>
      {(prev.length > 0 || nextToken) && (
        <div className="flex justify-end gap-2">
          {prev.length > 0 && (
            <Button variant="outline" disabled={query.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>
              Previous page
            </Button>
          )}
          {nextToken && (
            <Button disabled={query.isFetching} onClick={() => { setPrev((p) => [...p, skipToken]); setSkipToken(nextToken); }}>
              {query.isFetching ? "Loading…" : "Next page"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
