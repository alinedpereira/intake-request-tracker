import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileSearch, ListChecks, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RequestProgress } from "@/components/lifecycle";
import { RequestTaskPanel } from "@/components/request-tasks";
import { RequestFiles } from "@/components/request-files";
import { ownerNames, ownerOf, personWrite, requestorOf, useMyRequestScope, type Person } from "@/lib/people";
import { PersonPicker } from "@/components/person-picker";
import { WorkRequestList } from "@/components/work-request-list";
import { StatusPill } from "@/components/request-bits";
import { ChoiceSelect } from "@/components/choice-select";
import { useConfirm } from "@/hooks/use-confirm";
import { useAppStore } from "@/lib/store";
import {
  LIFECYCLE,
  REJECTED,
  appendLog,
  formatDate,
  parseLog,
  requestNumber,
  stageIndex,
  statusOf,
  updateRequest,
  useRequest,
  useRequestPage,
  type IntakeRequest,
  type IntakeWrite,
} from "@/lib/intake";
import { cn } from "@/lib/utils";

/** Stages an assignee can move forward from; sign-off stages wait for the requestor. */
const ASSIGNEE_NEXT: Record<string, string> = {
  Submitted: "Queued",
  Queued: "Assigned / Under Review",
  "Assigned / Under Review": "Requirements sign-off",
  Approved: "In Progress",
  "In Progress": "Acceptance sign-off",
};

export function RequestDetailPage({ withTasks = false }: { withTasks?: boolean }) {
  const { id } = useParams();
  const role = useAppStore((s) => s.role);
  const basePath = withTasks ? "/work" : "/requests";
  const q = useRequest(id);
  const from = (useLocation().state as { from?: string } | null)?.from;
  const backTo = withTasks && id ? "/work" : from === "/intakes" ? "/intakes" : "/";
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          <ArrowLeft className="size-4" aria-hidden="true" /> {backTo === "/work" ? "Back to all requests" : backTo === "/intakes" ? "Back to intake list" : "Back to my requests"}
        </Link>
        {!(withTasks && !id) && <RequestPicker currentId={id} basePath={basePath} />}
      </div>
      {withTasks && role === "Requestor" ? (
        <EmptyState icon={Lock} title="This screen is only available to assignees and managers" />
      ) : !id && withTasks ? (
        <WorkRequestList />
      ) : !id ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">{withTasks ? "Request and tasks" : "Request details"}</h1>
          <EmptyState icon={FileSearch} title={withTasks ? "Choose a request to see its details and tasks" : "Choose a request to see its details and progress"} />
        </>
      ) : q.isPending ? (
        <LoadingState rows={6} />
      ) : q.isError || !q.data ? (
        <ErrorState title="This request could not be loaded" action={<Button onClick={() => void q.refetch()}>Retry</Button>} />
      ) : (
        <Detail r={q.data} withTasks={withTasks} />
      )}
    </div>
  );
}

/** Jump to any request the current view can see. */
function RequestPicker({ currentId, basePath }: { currentId?: string; basePath: string }) {
  const navigate = useNavigate();
  const { role, needsIdentity, filter } = useMyRequestScope();
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const q = useRequestPage(filter, skipToken, 100);
  if (needsIdentity)
    return (
      <p className="text-sm text-muted-foreground">
        {role === "Requestor" ? "Pick yourself as Requestor on" : "Enter your name on"} <Link to="/" className="font-medium text-primary underline">My requests</Link> to pick a request.
      </p>
    );
  const rows = q.data?.rows ?? [];
  const nextToken = q.data?.nextToken;
  return (
    <div className="flex items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="pick-request">Open request</Label>
        {q.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Requests could not be loaded. <button type="button" className="underline" onClick={() => void q.refetch()}>Retry</button>
          </p>
        ) : (
          <div className="[&>[data-slot=native-select-wrapper]]:w-72">
            <NativeSelect
              id="pick-request"
              value={currentId ?? ""}
              disabled={q.isPending}
              onChange={(e) => e.target.value && navigate(`${basePath}/${e.target.value}`)}
              className="bg-card"
            >
              <NativeSelectOption value="">{q.isPending ? "Loading requests…" : rows.length ? "Choose a request…" : "No requests yet"}</NativeSelectOption>
              {rows.map((r) => (
                <NativeSelectOption key={r.ID} value={String(r.ID)}>
                  {requestNumber(r)} · {r.Title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>
      {prev.length > 0 && (
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>
          Newer
        </Button>
      )}
      {nextToken && (
        <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => { setPrev((p) => [...p, skipToken]); setSkipToken(nextToken); }}>
          Older
        </Button>
      )}
    </div>
  );
}

function Detail({ r, withTasks }: { r: IntakeRequest; withTasks: boolean }) {
  const role = useAppStore((s) => s.role);
  const myName = useAppStore((s) => s.myName);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const status = statusOf(r);
  const actor = myName || role;
  const log = parseLog(r.ActivityLog);

  const save = useMutation({
    mutationFn: ({ changes, note }: { changes: Partial<Omit<IntakeWrite, "ID">>; note: string }) =>
      updateRequest(r.ID as number, {
        ...changes,
        ActivityLog: appendLog(r.ActivityLog, { at: new Date().toISOString(), by: actor, role, text: note }),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["request", String(r.ID)], updated);
      void qc.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Saved");
    },
    onError: () => toast.error("The change could not be saved. Please try again."),
  });

  const setStatus = (to: string, extra: Partial<Omit<IntakeWrite, "ID">> = {}, note?: string) =>
    save.mutate({ changes: { Status: { Value: to }, ...extra }, note: note ?? `Status changed to ${to}` });

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{requestNumber(r)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{r.Title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!withTasks && role !== "Requestor" && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/work/${r.ID}`}>
                <ListChecks aria-hidden="true" /> Open with tasks
              </Link>
            </Button>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      <RequestProgress status={status} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <DetailSection title="Requestor">
            <Row k="Requestor" v={requestorOf(r)} />
            <Row k="Requestor's email" v={r.Requestor?.Email || r.Requestorsemail} />
            <Row k="On behalf of" v={r.OnBehalfOf} />
            <Row k="Business unit" v={r.BusinessUnit?.Value} />
            <Row k="Submitted" v={formatDate(r.SubmittedOn ?? r.Created)} />
          </DetailSection>
          <DetailSection title="Routing">
            <Row k="Level 1 type" v={r.RequestTypeL1?.Value} />
            <Row k="Level 2 type" v={r.RequestTypeL2} />
            <Row k="Routed to" v={r.RoutedTeam?.Value} />
            <Row k="Owner" v={ownerNames(r) ?? "Unassigned"} />
            <Row k="Request status" v={r.RequestStatus?.Value} />
            <Row k="Reference" v={r.Reference} />
            <Row k="Comments" v={r.RequestComments} />
          </DetailSection>
          <DetailSection title="Request">
            <Row k="Description" v={r.RequestDescription} />
          </DetailSection>
          <DetailSection title="Dates, priority and value">
            <Row k="Needed by" v={formatDate(r.NeededBy)} />
            <Row k="Priority" v={r.Priority?.Value} />
            <Row k="Business value" v={r.BusinessValue} />
            <Row k="Requirements" v={r.RequirementsSignedOff ? "Signed off" : "Not signed off"} />
            <Row k="Acceptance" v={r.AcceptanceSignedOff ? "Signed off" : "Not signed off"} />
          </DetailSection>
          <RequestFiles requestNo={requestNumber(r)} />
        </div>

      <div className="space-y-6">
        <section aria-labelledby="actions-h" className="space-y-3 border-t border-border pt-5">
          <h2 id="actions-h" className="text-lg font-semibold">{role} actions</h2>
          <CommentBox disabled={save.isPending} onAdd={(text) => save.mutate({ changes: {}, note: text })} />

          {role === "Requestor" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <SignOff
                label="Requirements sign-off"
                done={!!r.RequirementsSignedOff}
                enabled={status === "Requirements sign-off"}
                busy={save.isPending}
                onClick={() => setStatus("Approved", { RequirementsSignedOff: true }, "Requirements signed off")}
              />
              <SignOff
                label="Acceptance sign-off"
                done={!!r.AcceptanceSignedOff}
                enabled={status === "Acceptance sign-off"}
                busy={save.isPending}
                onClick={() => setStatus("Closed", { AcceptanceSignedOff: true }, "Work accepted and closed")}
              />
              <p className="text-xs italic text-muted-foreground sm:col-span-2">
                {status === "Requirements sign-off"
                  ? "The assignee is waiting for you to confirm the requirements."
                  : status === "Acceptance sign-off"
                    ? "The work is complete. Accept it to close the request."
                    : r.RequirementsSignedOff && !r.AcceptanceSignedOff
                      ? "Requirements signed off · acceptance sign-off unlocks when the work is complete."
                      : "Sign-off unlocks when the request reaches that stage."}
              </p>
            </div>
          )}

          {role === "Assignee" && <AssigneeActions status={status} busy={save.isPending} onMove={(to) => setStatus(to)} />}

          {role === "Manager" && (
            <ManagerActions
              r={r}
              busy={save.isPending}
              onAssign={(person) =>
                save.mutate({
                  changes: {
                    Owner: personWrite(person),
                    ...(stageIndex(status) < 2 ? { Status: { Value: "Assigned / Under Review" } } : {}),
                  },
                  note: `Owner set to ${person.DisplayName}`,
                })
              }
              onReference={(ref) => save.mutate({ changes: { Reference: ref }, note: `Reference set to ${ref}` })}
              onPriority={(p) => save.mutate({ changes: { Priority: { Value: p } }, note: `Priority set to ${p}` })}
              onStatus={(s) => setStatus(s)}
              onReject={async () => {
                const ok = await confirm({ title: "Reject this request?", description: "The requestor will see it as rejected.", confirmLabel: "Reject", destructive: true });
                if (ok) setStatus(REJECTED, {}, "Request rejected");
              }}
            />
          )}
        </section>

        <section aria-labelledby="log-h" className="space-y-2">
          <h2 id="log-h" className="text-lg font-semibold">Activity</h2>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-2">
              {[...log].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{e.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.by} · {e.role} · {new Date(e.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      </div>
      {withTasks && <RequestTaskPanel request={r} />}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <h2 className="border-l-4 border-primary bg-accent px-4 py-2 font-semibold text-accent-foreground">{title}</h2>
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 text-sm">{children}</dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="whitespace-pre-wrap break-words font-semibold">{v || "—"}</dd>
    </>
  );
}

function CommentBox({ onAdd, disabled }: { onAdd: (t: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
    >
      <Label htmlFor="comment" className="sr-only">Comment</Label>
      <Input id="comment" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="bg-card" />
      <Button type="submit" disabled={disabled || !text.trim()}>Add comment</Button>
    </form>
  );
}

function SignOff({ label, done, enabled, busy, onClick }: { label: string; done: boolean; enabled: boolean; busy: boolean; onClick: () => void }) {
  if (done)
    return (
      <p className="flex h-11 items-center justify-center gap-2 rounded-md border-2 border-emerald-700 bg-emerald-50 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <Check className="size-4" aria-hidden="true" /> {label} done
      </p>
    );
  return (
    <Button type="button" size="lg" variant={enabled ? "default" : "secondary"} disabled={!enabled || busy} onClick={onClick}>
      {label}
    </Button>
  );
}

function AssigneeActions({ status, busy, onMove }: { status: string; busy: boolean; onMove: (to: string) => void }) {
  const next = ASSIGNEE_NEXT[status];
  return (
    <div className="space-y-2">
      {next ? (
        <Button size="lg" disabled={busy} onClick={() => onMove(next)}>
          Move to “{next}”
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {status === "Requirements sign-off" || status === "Acceptance sign-off"
            ? "Waiting for the requestor to sign off."
            : "No further action at this stage."}
        </p>
      )}
    </div>
  );
}

function ManagerActions({
  r,
  busy,
  onAssign,
  onReference,
  onPriority,
  onStatus,
  onReject,
}: {
  r: IntakeRequest;
  busy: boolean;
  onAssign: (person: Person) => void;
  onReference: (ref: string) => void;
  onPriority: (p: string) => void;
  onStatus: (s: string) => void;
  onReject: () => void;
}) {
  const current = ownerOf(r);
  const [owner, setOwner] = useState<Person | null>(current);
  const ownerChanged = !!owner && owner.Claims !== current?.Claims;
  const [priority, setPriority] = useState(r.Priority?.Value ?? "");
  const [reference, setReference] = useState(r.Reference ?? "");
  const [status, setStatusDraft] = useState(statusOf(r));
  const closed = statusOf(r) === "Closed" || statusOf(r) === REJECTED;
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="owner-pick">Owner</Label>
        <div className="flex gap-2">
          <PersonPicker id="owner-pick" field="Owner" className="min-w-0 flex-1" value={owner} onChange={setOwner} />
          <Button type="button" disabled={busy || !ownerChanged} onClick={() => owner && onAssign(owner)}>Assign</Button>
        </div>
      </div>
      <form className="grid gap-1.5 sm:col-span-2" onSubmit={(e) => { e.preventDefault(); if (reference.trim()) onReference(reference.trim()); }}>
        <Label htmlFor="reference">Reference</Label>
        <div className="flex gap-2">
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. project or ticket reference" />
          <Button type="submit" variant="outline" disabled={busy || !reference.trim() || reference.trim() === r.Reference}>Set</Button>
        </div>
      </form>
      <div className="grid gap-1.5">
        <Label htmlFor="m-priority">Priority</Label>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><ChoiceSelect id="m-priority" field="Priority" value={priority} onChange={setPriority} /></div>
          <Button variant="outline" disabled={busy || !priority || priority === r.Priority?.Value} onClick={() => onPriority(priority)}>Set</Button>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-status">Status</Label>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><ChoiceSelect id="m-status" field="Status" value={status} onChange={setStatusDraft} /></div>
          <Button variant="outline" disabled={busy || !status || status === statusOf(r)} onClick={() => onStatus(status)}>Set</Button>
        </div>
      </div>
      <div className={cn("sm:col-span-2", closed && "hidden")}>
        <Button variant="destructive" disabled={busy} onClick={onReject}>Reject request</Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Lifecycle: {LIFECYCLE.join(" → ")}</p>
    </div>
  );
}
