import { LIFECYCLE } from "@/lib/intake";

const ROLES = [
  {
    role: "Requestor",
    does: "Submits requests, follows progress, adds comments, and signs off requirements and the finished work.",
  },
  {
    role: "Assignee",
    does: "Works requests assigned to them, moves them through the stages, tracks internal tasks, and asks the requestor for sign-off.",
  },
  {
    role: "Manager",
    does: "Sees every request, assigns work, sets priority and status, rejects requests, manages internal tasks, and uses the dashboard.",
  },
];

const FAQ = [
  { q: "How do I find my requests?", a: "Open My requests and pick yourself in the Requestor box." },
  { q: "Who decides which team gets my request?", a: "The Level 1 request type sets the routed team automatically." },
  { q: "When can I sign off?", a: "Requirements sign-off unlocks when the assignee moves the request to that stage. Acceptance sign-off unlocks once the work is complete." },
  { q: "Can I change a request after submitting?", a: "Add a comment with the change. The assignee and manager see every comment in the activity list." },
];

export function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-5 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Help</h1>

      <section aria-labelledby="roles-h" className="space-y-3">
        <h2 id="roles-h" className="border-l-4 border-primary bg-accent px-4 py-2.5 font-semibold text-accent-foreground">Roles</h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.role} className="rounded-lg border border-border bg-card p-4">
              <dt className="font-semibold">{r.role}</dt>
              <dd className="mt-1 text-sm">{r.does}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="stages-h" className="space-y-3">
        <h2 id="stages-h" className="border-l-4 border-primary bg-accent px-4 py-2.5 font-semibold text-accent-foreground">Request stages</h2>
        <ol className="grid gap-2 sm:grid-cols-4">
          {LIFECYCLE.map((s, i) => (
            <li key={s} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq-h" className="space-y-3">
        <h2 id="faq-h" className="border-l-4 border-primary bg-accent px-4 py-2.5 font-semibold text-accent-foreground">Common questions</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-lg border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
