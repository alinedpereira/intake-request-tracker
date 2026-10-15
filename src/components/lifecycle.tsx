import { Check } from "lucide-react";
import { LIFECYCLE, REJECTED, stageIndex } from "@/lib/intake";
import { cn } from "@/lib/utils";

/** Vertical stage timeline for one request. */
export function LifecycleTimeline({ status }: { status: string }) {
  const current = stageIndex(status);
  const rejected = status === REJECTED;
  return (
    <ol className="relative space-y-0" aria-label="Request progress">
      {LIFECYCLE.map((stage, i) => {
        const done = !rejected && (i < current || (status === "Closed" && i === current));
        const isCurrent = !rejected && i === current && status !== "Closed";
        return (
          <li key={stage} className="relative flex items-start gap-3 pb-5 last:pb-0">
            {i < LIFECYCLE.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5", done ? "bg-emerald-700" : "bg-border")}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                done && "border-emerald-700 bg-emerald-700 text-white",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !done && !isCurrent && "border-border bg-card",
              )}
            >
              {done && <Check className="size-4" />}
            </span>
            <span className={cn("pt-0.5 text-sm", done || isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {stage}
              <span className="sr-only">{done ? " (complete)" : isCurrent ? " (current stage)" : " (not started)"}</span>
            </span>
          </li>
        );
      })}
      {rejected && (
        <li className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">Rejected</li>
      )}
    </ol>
  );
}

/** Horizontal pipeline diagram with request counts per stage. */
export function PipelineDiagram({ counts, title }: { counts: Record<string, number>; title: string }) {
  const stages = LIFECYCLE;
  const max = Math.max(1, ...stages.map((s) => counts[s] ?? 0));
  const w = 880;
  const h = 170;
  const step = w / stages.length;
  return (
    <figure className="rounded-lg border border-border bg-card p-4">
      <figcaption id="pipeline-title" className="mb-2 text-sm font-semibold">
        {title}
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby="pipeline-svg-title pipeline-svg-desc" className="w-full">
        <title id="pipeline-svg-title">{title}</title>
        <desc id="pipeline-svg-desc">
          {stages.map((s) => `${s}: ${counts[s] ?? 0}`).join("; ")}
        </desc>
        <line x1={step / 2} x2={w - step / 2} y1={110} y2={110} className="stroke-border" strokeWidth={4} />
        {stages.map((s, i) => {
          const n = counts[s] ?? 0;
          const cx = step / 2 + i * step;
          const r = 10 + (n / max) * 18;
          return (
            <g key={s}>
              <circle cx={cx} cy={110} r={n ? r : 8} className={n ? "fill-primary" : "fill-muted stroke-border"} strokeWidth={2} />
              <text x={cx} y={110 - (n ? r : 8) - 8} textAnchor="middle" className="fill-foreground text-[15px] font-semibold">
                {n}
              </text>
              <text x={cx} y={155} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {s.length > 16 ? s.replace(" / Under Review", "").replace(" sign-off", "") : s}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

const SHORT: Record<string, string> = {
  "Assigned / Under Review": "Assigned",
  "Requirements sign-off": "Requirements",
  "Acceptance sign-off": "Acceptance",
};

/** Horizontal progress bar for a single request. */
export function RequestProgress({ status }: { status: string }) {
  const current = stageIndex(status);
  const rejected = status === REJECTED;
  const closed = status === "Closed";
  const pct = current <= 0 ? 0 : (current / (LIFECYCLE.length - 1)) * 100;
  return (
    <section aria-labelledby="progress-h" className="rounded-lg border border-border bg-card p-5">
      <h2 id="progress-h" className="text-sm font-semibold">Where this request is in the process</h2>
      {rejected ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">This request was rejected.</p>
      ) : (
        <div className="relative mt-6 overflow-x-auto pb-1">
          <div className="relative min-w-[640px]">
            <div aria-hidden="true" className="absolute left-[6.25%] right-[6.25%] top-[22px] h-1.5 rounded-full bg-border">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <ol className="relative grid grid-cols-8" aria-label="Request stages">
              {LIFECYCLE.map((stage, i) => {
                const done = i < current || (closed && i === current);
                const isCurrent = i === current && !closed;
                return (
                  <li key={stage} aria-current={isCurrent ? "step" : undefined} className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-12 items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex items-center justify-center rounded-full border-2",
                          isCurrent && "size-12 border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                          done && "size-7 border-primary bg-primary text-primary-foreground",
                          !done && !isCurrent && "size-6 border-border bg-card",
                        )}
                      >
                        {done && <Check className="size-4" />}
                        {isCurrent && <span className="text-sm font-bold">{i + 1}</span>}
                      </span>
                    </span>
                    <span className={cn("px-1 text-xs", isCurrent ? "font-bold text-foreground" : done ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {SHORT[stage] ?? stage}
                      <span className="sr-only">{done ? " (complete)" : isCurrent ? " (current stage)" : " (not started)"}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
