import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PipelineDiagram } from "@/components/lifecycle";
import { TaskCharts } from "@/components/task-charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ownerOf } from "@/lib/people";
import { PriorityText, StatusPill } from "@/components/request-bits";
import { useAppStore } from "@/lib/store";
import { LIFECYCLE, REJECTED, formatDate, isOverdue, requestNumber, statusOf, useRequestPage, type IntakeRequest } from "@/lib/intake";

const DASH_PAGE = 250;
const chartConfig = { open: { label: "Open requests", color: "var(--chart-1)" } } satisfies ChartConfig;

export function DashboardPage() {
  const role = useAppStore((s) => s.role);
  if (role !== "Manager")
    return (
      <div className="p-8">
        <EmptyState icon={LayoutDashboard} title="The dashboard is for managers" description="Switch “View as” to Manager to open it." />
      </div>
    );
  return <Dashboard />;
}

function Dashboard() {
  const [skipToken, setSkipToken] = useState<string | undefined>();
  const [prev, setPrev] = useState<(string | undefined)[]>([]);
  const q = useRequestPage(undefined, skipToken, DASH_PAGE);
  const rows = q.data?.rows ?? [];
  const nextToken = q.data?.nextToken;

  const pager = (prev.length > 0 || nextToken) && (
    <div className="flex items-center gap-2">
      {prev.length > 0 && (
        <Button variant="outline" disabled={q.isFetching} onClick={() => { setSkipToken(prev[prev.length - 1]); setPrev((p) => p.slice(0, -1)); }}>
          Newer requests
        </Button>
      )}
      {nextToken && (
        <Button variant="outline" disabled={q.isFetching} onClick={() => { setPrev((p) => [...p, skipToken]); setSkipToken(nextToken); }}>
          Older requests
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Manager dashboard</h1>
      <Tabs defaultValue="requests" className="gap-6">
        <TabsList aria-label="Dashboard sections">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Requests</h2>
            {pager}
          </div>
          {q.isPending ? (
            <LoadingState rows={6} />
          ) : q.isError ? (
            <ErrorState title="Request charts could not be loaded" action={<Button onClick={() => void q.refetch()}>Retry</Button>} />
          ) : rows.length === 0 && prev.length === 0 ? (
            <EmptyState icon={LayoutDashboard} title="No requests have been submitted yet" />
          ) : (
            <DashboardBody rows={rows} partial={!!nextToken || prev.length > 0} />
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <TaskCharts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardBody({ rows, partial }: { rows: IntakeRequest[]; partial: boolean }) {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[statusOf(r)] = (counts[statusOf(r)] ?? 0) + 1;
  const open = rows.filter((r) => !["Closed", REJECTED].includes(statusOf(r)));
  const unassigned = open.filter((r) => !ownerOf(r));
  const overdue = open.filter(isOverdue);
  const byTeam = new Map<string, number>();
  for (const r of open) {
    const t = r.RoutedTeam?.Value ?? "Not routed";
    byTeam.set(t, (byTeam.get(t) ?? 0) + 1);
  }
  const teamData = [...byTeam.entries()].map(([team, n]) => ({ team, open: n })).sort((a, b) => b.open - a.open);

  return (
    <>
      {partial && <p className="text-sm text-muted-foreground">Figures cover the {rows.length} requests on this page.</p>}
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open" value={open.length} />
        <Stat label="Unassigned" value={unassigned.length} tone={unassigned.length ? "warn" : undefined} />
        <Stat label="Past needed-by date" value={overdue.length} tone={overdue.length ? "bad" : undefined} />
      </dl>

      <PipelineDiagram counts={counts} title="Requests by stage" />
      {(counts[REJECTED] ?? 0) > 0 && <p className="text-sm text-muted-foreground">Rejected: {counts[REJECTED]}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="team-h" className="rounded-lg border border-border bg-card p-4">
          <h2 id="team-h" className="font-semibold">Open requests by team</h2>
          <p className="text-sm text-muted-foreground">
            {teamData.length ? `${teamData[0].team} holds the most open requests (${teamData[0].open}).` : "No open requests."}
          </p>
          {teamData.length > 0 && (
            <>
              <ChartContainer config={chartConfig} className="mt-3 h-56" aria-hidden="true">
                <BarChart data={teamData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="team" width={150} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="open" fill="var(--color-open)" radius={4} />
                </BarChart>
              </ChartContainer>
              <table className="mt-3 w-full text-sm">
                <caption className="sr-only">Open requests by team</caption>
                <thead><tr className="text-left text-muted-foreground"><th scope="col" className="py-1 font-medium">Team</th><th scope="col" className="py-1 text-right font-medium">Open</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {teamData.map((t) => (<tr key={t.team}><td className="py-1">{t.team}</td><td className="py-1 text-right font-semibold">{t.open}</td></tr>))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section aria-labelledby="attn-h" className="rounded-lg border border-border bg-card p-4">
          <h2 id="attn-h" className="font-semibold">Needs attention</h2>
          {[...overdue, ...unassigned.filter((r) => !overdue.includes(r))].length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Every open request is assigned and on time.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {[...overdue, ...unassigned.filter((r) => !overdue.includes(r))].slice(0, 10).map((r) => (
                <li key={r.ID} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link to={`/requests/${r.ID}`} className="block truncate font-semibold text-primary hover:underline">{r.Title}</Link>
                    <span className="text-xs text-muted-foreground">
                      {requestNumber(r)} · needed {formatDate(r.NeededBy)} · <PriorityText priority={r.Priority?.Value} />
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill status={statusOf(r)} />
                    <span className="text-xs font-semibold">
                      {isOverdue(r) ? <span className="text-red-700 dark:text-red-400">Overdue</span> : null}
                      {isOverdue(r) && !ownerOf(r) ? " · " : null}
                      {!ownerOf(r) ? "Unassigned" : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="sr-only">Stages: {LIFECYCLE.map((s) => `${s} ${counts[s] ?? 0}`).join(", ")}</p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={tone === "bad" ? "text-3xl font-semibold text-red-700 dark:text-red-400" : tone === "warn" ? "text-3xl font-semibold text-amber-800 dark:text-amber-300" : "text-3xl font-semibold"}>{value}</dd>
    </div>
  );
}
