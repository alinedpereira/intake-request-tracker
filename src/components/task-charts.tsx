import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { addWeeks, format, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ErrorState, LoadingState } from "@/components/states";
import { taskAssigneeName, taskStatusOf, useTaskPage, useTaskStatuses, type IntakeTask } from "@/lib/tasks";
import type { ReactNode } from "react";

const TASK_SCAN = 1000;

const statusConfig = { count: { label: "Tasks", color: "var(--chart-1)" } } satisfies ChartConfig;
const splitConfig = {
  open: { label: "Open", color: "var(--chart-1)" },
  done: { label: "Done", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Task charts for the manager dashboard: by status, by owner, by due week. */
export function TaskCharts() {
  const q = useTaskPage(undefined, undefined, TASK_SCAN);
  const statuses = useTaskStatuses();

  return (
    <section aria-labelledby="task-charts-h" className="space-y-4">
      <h2 id="task-charts-h" className="text-xl font-semibold tracking-tight">Tasks</h2>
      {q.isPending || statuses.isPending ? (
        <LoadingState rows={4} />
      ) : q.isError || statuses.isError ? (
        <ErrorState className="py-8" title="Task charts could not be loaded" action={<Button onClick={() => { void q.refetch(); void statuses.refetch(); }}>Retry</Button>} />
      ) : q.data.rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No tasks have been created yet.</p>
      ) : (
        <Charts tasks={q.data.rows} statuses={statuses.data} partial={!!q.data.nextToken} />
      )}
    </section>
  );
}

function Charts({ tasks, statuses, partial }: { tasks: IntakeTask[]; statuses: string[]; partial: boolean }) {
  // 1. By status (configured order)
  const byStatus = statuses.map((s) => ({ status: s, count: tasks.filter((t) => taskStatusOf(t) === s).length }));
  const topStatus = [...byStatus].sort((a, b) => b.count - a.count)[0];

  // 2. Per owner, open vs done
  const owners = new Map<string, { open: number; done: number }>();
  for (const t of tasks) {
    const o = taskAssigneeName(t) ?? "Unassigned";
    const c = owners.get(o) ?? { open: 0, done: 0 };
    if (taskStatusOf(t) === "Done") c.done += 1;
    else c.open += 1;
    owners.set(o, c);
  }
  const byOwner = [...owners.entries()]
    .map(([owner, c]) => ({ owner, ...c }))
    .sort((a, b) => b.open - a.open || b.done - a.done)
    .slice(0, 12);
  const busiest = byOwner[0];

  // 3. By due week: 4 weeks back to 8 weeks ahead
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weeks = Array.from({ length: 13 }, (_, i) => addWeeks(thisWeek, i - 4));
  const byWeek = weeks.map((w) => ({ week: format(w, "d MMM"), start: w.getTime(), open: 0, done: 0 }));
  let noDate = 0;
  let earlier = 0;
  let later = 0;
  let overdueOpen = 0;
  for (const t of tasks) {
    const done = taskStatusOf(t) === "Done";
    if (!t.DueDate) { noDate += 1; continue; }
    const due = new Date(t.DueDate);
    if (!done && due.getTime() < Date.now()) overdueOpen += 1;
    const ws = startOfWeek(due, { weekStartsOn: 1 }).getTime();
    const bucket = byWeek.find((b) => b.start === ws);
    if (bucket) bucket[done ? "done" : "open"] += 1;
    else if (ws < weeks[0].getTime()) earlier += 1;
    else later += 1;
  }
  const nextTwo = byWeek.filter((b) => b.start >= thisWeek.getTime()).slice(0, 2).reduce((n, b) => n + b.open, 0);

  return (
    <>
      {partial && <p className="text-sm text-muted-foreground">Task charts cover the {tasks.length} most recent tasks.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          id="tc-status"
          title="Tasks by status"
          summary={`${tasks.length} tasks in total; the most are ${topStatus.status.toLowerCase()} (${topStatus.count}).`}
          table={<SimpleTable caption="Tasks by status" head={["Status", "Tasks"]} rows={byStatus.map((s) => [s.status, s.count])} />}
        >
          <ChartContainer config={statusConfig} className="h-56" aria-hidden="true">
            <BarChart data={byStatus} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="status" tickLine={false} />
              <YAxis allowDecimals={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          id="tc-owner"
          title="Tasks per assignee"
          summary={busiest ? `${busiest.owner} has the most open tasks (${busiest.open}).` : "No tasks."}
          table={<SimpleTable caption="Tasks per assignee" head={["Assignee", "Open", "Done"]} rows={byOwner.map((o) => [o.owner, o.open, o.done])} />}
        >
          <ChartContainer config={splitConfig} className="h-56" aria-hidden="true">
            <BarChart data={byOwner} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="owner" width={120} tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
              <Bar dataKey="done" stackId="a" fill="var(--color-done)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            id="tc-date"
            title="Tasks by due week"
            summary={`${overdueOpen} open task${overdueOpen === 1 ? " is" : "s are"} past due; ${nextTwo} open task${nextTwo === 1 ? " is" : "s are"} due this week or next.${noDate ? ` ${noDate} without a due date.` : ""}${earlier || later ? ` ${earlier} due before and ${later} after the weeks shown.` : ""}`}
            table={<SimpleTable caption="Tasks by due week (week starting)" head={["Week starting", "Open", "Done"]} rows={byWeek.map((w) => [w.week, w.open, w.done])} />}
          >
            <ChartContainer config={splitConfig} className="h-60" aria-hidden="true">
              <BarChart data={byWeek} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="week" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
                <Bar dataKey="done" stackId="a" fill="var(--color-done)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function ChartCard({ id, title, summary, table, children }: { id: string; title: string; summary: string; table: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="rounded-lg border border-border bg-card p-4">
      <h3 id={`${id}-h`} className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="mt-3">{children}</div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-primary">Show data table</summary>
        <div className="mt-2">{table}</div>
      </details>
    </section>
  );
}

function SimpleTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-muted-foreground">
          {head.map((h, i) => <th key={h} scope="col" className={i ? "py-1 text-right font-medium" : "py-1 font-medium"}>{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={String(r[0])}>
            {r.map((c, i) => <td key={i} className={i ? "py-1 text-right font-semibold" : "py-1"}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
