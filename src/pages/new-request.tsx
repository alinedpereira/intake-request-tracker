import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ChoiceSelect } from "@/components/choice-select";
import { useAppStore } from "@/lib/store";
import { LEVEL2_BY_LEVEL1, TEAM_BY_LEVEL1, appendLog, createRequest, requestNumber, useChoices } from "@/lib/intake";
import { ensureRequestFolder } from "@/lib/files";
import { personWrite, type Person } from "@/lib/people";
import { PersonPicker } from "@/components/person-picker";
import { cn } from "@/lib/utils";

const STEPS = ["Routing", "Request", "Priorities"] as const;

interface Draft {
  requestor: Person | null;
  businessUnit: string;
  onBehalfOf: string;
  level1: string;
  level2: string;
  comments: string;
  title: string;
  description: string;
  neededBy: string;
  priority: string;
  value: string;
}

export function NewRequestPage() {
  const me = useAppStore((s) => s.me);
  const role = useAppStore((s) => s.role);
  const setMe = useAppStore((s) => s.setMe);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const teams = useChoices("RoutedTeam");
  const [step, setStep] = useState(0);
  const [requestorError, setRequestorError] = useState(false);
  const [done, setDone] = useState<{ id?: number; no: string; title: string; folderReady: boolean } | null>(null);
  const [d, setD] = useState<Draft>({
    requestor: role === "Requestor" ? me : null,
    businessUnit: "",
    onBehalfOf: "",
    level1: "",
    level2: "",
    comments: "",
    title: "",
    description: "",
    neededBy: "",
    priority: "",
    value: "",
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const mappedTeam = d.level1 ? TEAM_BY_LEVEL1[d.level1] : undefined;
  const routedTeam = mappedTeam && teams.data?.includes(mappedTeam) ? mappedTeam : "";

  const submit = useMutation({
    mutationFn: () =>
      createRequest({
        Title: d.title.trim(),
        Requestor: d.requestor ? personWrite(d.requestor) : undefined,
        Requestorsemail: d.requestor?.Email || undefined,
        OnBehalfOf: d.onBehalfOf.trim() || undefined,
        BusinessUnit: d.businessUnit ? { Value: d.businessUnit } : undefined,
        RequestTypeL1: d.level1 ? { Value: d.level1 } : undefined,
        RequestTypeL2: d.level2 || undefined,
        RoutedTeam: routedTeam ? { Value: routedTeam } : undefined,
        RequestComments: d.comments.trim() || undefined,
        RequestDescription: d.description.trim(),
        NeededBy: d.neededBy ? `${d.neededBy}T12:00:00Z` : undefined,
        Priority: d.priority ? { Value: d.priority } : undefined,
        BusinessValue: d.value.trim() || undefined,
        Status: { Value: "Submitted" },
        RequirementsSignedOff: false,
        AcceptanceSignedOff: false,
        SubmittedOn: new Date().toISOString(),
        ActivityLog: appendLog(undefined, {
          at: new Date().toISOString(),
          by: d.requestor?.DisplayName ?? "",
          role: "Requestor",
          text: "Request submitted",
        }),
      }),
    onSuccess: async (created) => {
      void qc.invalidateQueries({ queryKey: ["requests"] });
      if (role === "Requestor" && d.requestor) setMe(d.requestor);
      toast.success("Request submitted");
      const no = created ? requestNumber(created) : "";
      let folderReady = false;
      if (created?.RequestNumber) {
        try {
          await ensureRequestFolder(created.RequestNumber);
          folderReady = true;
        } catch {
          folderReady = false;
        }
      }
      setDone({ id: created?.ID, no, title: created?.Title ?? d.title, folderReady });
    },
    onError: () => toast.error("The request could not be submitted. Please try again."),
  });

  function next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 0 && !d.requestor) {
      setRequestorError(true);
      document.getElementById("requestor")?.focus();
      return;
    }
    if (step < 2) setStep(step + 1);
    else submit.mutate();
  }

  if (done) {
    return (
      <div className="mx-auto max-w-3xl p-5 md:p-8">
        <section aria-labelledby="done-h" className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-1 size-7 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <h1 id="done-h" className="text-2xl font-semibold tracking-tight">Request submitted</h1>
              <p className="mt-1 text-sm"><span className="font-semibold">{done.no}</span> · {done.title}</p>
            </div>
          </div>
          <p className="border-t border-border pt-4 text-sm">Add supporting files from the Files section on the request page.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" disabled={!done.id} onClick={() => navigate(`/requests/${done.id}`)}>
              <Upload aria-hidden="true" /> View request and add files
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          New request · page {step + 1} of 3
        </h1>
        <ol className="flex items-center gap-2" aria-label="Form steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
              {i > 0 && <span aria-hidden="true" className="h-0.5 w-6 bg-border" />}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary bg-primary text-primary-foreground",
                  i > step && "border-border bg-card text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>
                {s}
                {i < step && <span className="sr-only"> (complete)</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={next} className="mt-6 space-y-6">
        {step === 0 && (
          <>
            <Section title="Requestor">
              <Field id="requestor" label="Requestor" required>
                <PersonPicker id="requestor" value={d.requestor} onChange={(p) => { set("requestor", p); setRequestorError(false); }} />
                {requestorError && <p role="alert" className="text-sm text-destructive">Pick the requestor from the list.</p>}
              </Field>
              <Field id="bu" label="Business unit (on whose behalf)">
                <ChoiceSelect id="bu" field="BusinessUnit" value={d.businessUnit} onChange={(v) => set("businessUnit", v)} />
              </Field>
              <Field id="obo" label="Requested on behalf of">
                <Input id="obo" value={d.onBehalfOf} onChange={(e) => set("onBehalfOf", e.target.value)} placeholder="Leave blank if it's for you" className="bg-card" />
              </Field>
            </Section>
            <Section title="Request routing">
              <Field id="l1" label="Level 1 request type" required>
                <ChoiceSelect id="l1" field="RequestTypeL1" required value={d.level1} onChange={(v) => setD((p) => ({ ...p, level1: v, level2: "" }))} />
              </Field>
              <Field id="team" label="Routed to team">
                <Input id="team" readOnly value={routedTeam} placeholder="Set by the Level 1 request type" className="bg-muted" />
              </Field>
              <Field id="l2" label="Level 2 request type">
                <div className="[&>[data-slot=native-select-wrapper]]:w-full">
                  <NativeSelect id="l2" value={d.level2} disabled={!d.level1} onChange={(e) => set("level2", e.target.value)} className="bg-card">
                    <NativeSelectOption value="">{d.level1 ? "Choose…" : "Pick a Level 1 type first"}</NativeSelectOption>
                    {(LEVEL2_BY_LEVEL1[d.level1] ?? []).map((o) => (
                      <NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </Field>
              <Field id="comments" label="Request comments">
                <Input id="comments" value={d.comments} onChange={(e) => set("comments", e.target.value)} placeholder="Extra detail to direct the request" className="bg-card" />
              </Field>
            </Section>
          </>
        )}

        {step === 1 && (
          <Section title="Request title and description" single>
            <Field id="title" label="Request title" required>
              <Input id="title" required maxLength={255} value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="One-line phrase to identify the project" className="bg-card" />
            </Field>
            <Field id="desc" label="Request description" required hint="Goal, background, scope, and definition of done.">
              <Textarea id="desc" required rows={9} value={d.description} onChange={(e) => set("description", e.target.value)} aria-describedby="desc-hint" className="bg-card" />
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section title="Dates, priority and value">
            <Field id="needed" label="Needed by" required>
              <Input id="needed" type="date" required value={d.neededBy} onChange={(e) => set("neededBy", e.target.value)} className="bg-card" />
            </Field>
            <Field id="priority" label="Priority" required>
              <ChoiceSelect id="priority" field="Priority" required value={d.priority} onChange={(v) => set("priority", v)} />
            </Field>
            <div className="md:col-span-2">
              <Field id="value" label="Business value" hint="Who benefits and what changes when this is done.">
                <Textarea id="value" rows={5} value={d.value} onChange={(e) => set("value", e.target.value)} aria-describedby="value-hint" className="bg-card" />
              </Field>
            </div>
          </Section>
        )}

        {step === 2 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Upload className="size-4" aria-hidden="true" /> You can add supporting files on the request page right after you submit.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
              <ArrowLeft aria-hidden="true" /> Previous page
            </Button>
          )}
          <Button type="submit" size="lg" disabled={submit.isPending}>
            {step < 2 ? (
              <>
                Next <ArrowRight aria-hidden="true" />
              </>
            ) : submit.isPending ? (
              "Submitting…"
            ) : (
              "Submit request"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children, single }: { title: string; children: ReactNode; single?: boolean }) {
  return (
    <section className="space-y-4">
      <h2 className="border-l-4 border-primary bg-accent px-4 py-2.5 text-base font-semibold text-accent-foreground">{title}</h2>
      <div className={cn("grid gap-x-8 gap-y-4", !single && "md:grid-cols-2")}>{children}</div>
    </section>
  );
}

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="font-semibold">
        {label}
        {required && <span className="text-primary" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs italic text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}
