import { useQuery } from "@tanstack/react-query";
import { IntakeRequestsService } from "../../generated";
import type {
  IntakeRequestsRead,
  IntakeRequestsWrite,
} from "../../generated/models/IntakeRequestsModel";

export type IntakeRequest = IntakeRequestsRead;
export type IntakeWrite = IntakeRequestsWrite;

/** Ordered lifecycle shown on every request timeline. */
export const LIFECYCLE = [
  "Submitted",
  "Queued",
  "Assigned / Under Review",
  "Requirements sign-off",
  "Approved",
  "In Progress",
  "Acceptance sign-off",
  "Closed",
] as const;

export const REJECTED = "Rejected";

/**
 * Progress-bar stage (Status column) -> "Request Status" column choice.
 * Request Status has no requirements sign-off stage, so that stage stays "Assigned/Under Review".
 * "On Hold" has no progress-bar stage and is never set by the app.
 */
export const REQUEST_STATUS_BY_STAGE: Record<string, string> = {
  Submitted: "Submitted",
  Queued: "Queued",
  "Assigned / Under Review": "Assigned/Under Review",
  "Requirements sign-off": "Assigned/Under Review",
  Approved: "Approved",
  "In Progress": "In progress",
  "Acceptance sign-off": "Delivered/Pending Business Approval",
  Closed: "Closed",
  [REJECTED]: "Cancelled",
};

/** Add the matching Request Status whenever a change sets the progress-bar Status. */
function withRequestStatus<T extends Partial<Omit<IntakeWrite, "ID">>>(changes: T): T {
  const stage = changes.Status?.Value;
  if (!stage) return changes;
  const mapped = REQUEST_STATUS_BY_STAGE[stage];
  if (!mapped) {
    console.error("no Request Status mapping for stage", stage);
    return changes;
  }
  return { ...changes, RequestStatus: { Value: mapped } };
}

/** Level 2 request types offered for each Level 1 type. */
export const LEVEL2_BY_LEVEL1: Record<string, string[]> = {
  "Reporting & Analytics": ["New dashboard", "Change to existing report", "KPI definition", "Ad-hoc analysis"],
  "Application Change": ["Bug fix", "Enhancement", "New integration", "Configuration change"],
  "Access & Accounts": ["New access", "Access removal", "Role change", "Shared mailbox"],
  "Data Request": ["Data extract", "Data correction", "New data feed", "Data retention question"],
  "Process Improvement": ["Automation idea", "Process redesign", "Policy clarification", "Training need"],
};

/** Routed-to team derived from the Level 1 request type. */
export const TEAM_BY_LEVEL1: Record<string, string> = {
  "Reporting & Analytics": "Analytics Team",
  "Application Change": "Applications Team",
  "Access & Accounts": "Identity & Access Team",
  "Data Request": "Data Engineering Team",
  "Process Improvement": "Business Excellence Team",
};

export interface LogEntry {
  at: string;
  by: string;
  role: string;
  text: string;
}

export function parseLog(raw: string | undefined): LogEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LogEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as LogEntry).at === "string" &&
        typeof (e as LogEntry).text === "string",
    );
  } catch {
    return [];
  }
}

export function appendLog(raw: string | undefined, entry: LogEntry): string {
  return JSON.stringify([...parseLog(raw), entry]);
}

export function statusOf(r: IntakeRequest): string {
  return r.Status?.Value ?? "Submitted";
}

export function stageIndex(status: string): number {
  return LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);
}

export function requestNumber(r: IntakeRequest): string {
  if (r.RequestNumber) return r.RequestNumber;
  return r.ID ? `INT-${String(r.ID).padStart(5, "0")}` : "INT-pending";
}

export function buildRequestNumber(id: number, when: Date): string {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  return `INT-${y}${m}${d}-${String(id).padStart(5, "0")}`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function isOverdue(r: IntakeRequest): boolean {
  if (!r.NeededBy) return false;
  const s = statusOf(r);
  if (s === "Closed" || s === REJECTED) return false;
  return new Date(r.NeededBy).getTime() < Date.now();
}

export function odataString(v: string): string {
  return `'${v.replaceAll("'", "''")}'`;
}

/** Fields read for every list/detail view (all confirmed in the generated model). */
export const SELECT_FIELDS = [
  "ID",
  "Title",
  "RequestNumber",
  "Requestor",
  "Requestorsemail",
  "OnBehalfOf",
  "BusinessUnit",
  "RequestTypeL1",
  "RequestTypeL2",
  "RoutedTeam",
  "RequestComments",
  "RequestDescription",
  "NeededBy",
  "Priority",
  "BusinessValue",
  "Status",
  "RequestStatus",
  "Owner",
  "RequirementsSignedOff",
  "AcceptanceSignedOff",
  "SubmittedOn",
  "ActivityLog",
  "Reference",
  "Created",
  "Modified",
];

export type ChoiceField = "BusinessUnit" | "RequestTypeL1" | "RoutedTeam" | "Priority" | "Status";

/** Narrow the SharePoint Choice payload (direct array or { value: [...] }) to option labels. */
export function parseChoices(payload: unknown): string[] {
  const raw = Array.isArray(payload)
    ? payload
    : typeof payload === "object" &&
        payload !== null &&
        "value" in payload &&
        Array.isArray((payload as { value: unknown }).value)
      ? (payload as { value: unknown[] }).value
      : null;
  if (raw === null) throw new Error("Unsupported SharePoint Choice response shape");
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null && "Value" in item) {
      const v = (item as { Value: unknown }).Value;
      if (typeof v === "string") return v;
    }
    throw new Error("Unsupported SharePoint Choice item shape");
  });
}

export function useChoices(field: ChoiceField) {
  return useQuery({
    queryKey: ["choices", field],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const result = await IntakeRequestsService.getReferencedEntity("", field);
      if (!result.success) {
        console.error("choice load failed", field, result.error);
        throw new Error("Unable to load options.");
      }
      return parseChoices(result.data);
    },
  });
}

export const PAGE_SIZE = 50;

export function useRequestPage(filter: string | undefined, skipToken: string | undefined, top = PAGE_SIZE) {
  return useQuery({
    queryKey: ["requests", { filter, skipToken, top }],
    queryFn: async () => {
      const result = await IntakeRequestsService.getAll({
        select: SELECT_FIELDS,
        filter,
        orderBy: ["ID desc"],
        top,
        skipToken,
      });
      if (!result.success) {
        console.error("intake list load failed", result.error);
        throw new Error("Unable to load requests.");
      }
      return { rows: result.data ?? [], nextToken: result.skipToken?.trim() || undefined };
    },
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["request", id],
    enabled: !!id,
    queryFn: async () => {
      const n = Number(id);
      if (!Number.isInteger(n) || n <= 0) throw new Error("Invalid request id.");
      // Single-item reads by id return 404 through this connector; read the row via a filtered list query instead.
      const result = await IntakeRequestsService.getAll({ select: SELECT_FIELDS, filter: `ID eq ${n}`, top: 1 });
      if (!result.success) {
        console.error("intake load failed", result.error);
        throw new Error("Unable to load this request.");
      }
      const row = (result.data ?? [])[0];
      if (!row) throw new Error("Request not found.");
      return row;
    },
  });
}

export async function createRequest(record: Omit<IntakeWrite, "ID">): Promise<IntakeRequest> {
  const result = await IntakeRequestsService.create(withRequestStatus(record));
  if (!result.success) {
    console.error("intake create failed", result.error);
    throw new Error("The request could not be submitted.");
  }
  const created = result.data;
  if (created?.ID) {
    const num = buildRequestNumber(created.ID, new Date());
    const upd = await IntakeRequestsService.update(String(created.ID), { RequestNumber: num });
    if (!upd.success) console.error("request number update failed", upd.error);
    else return upd.data;
  }
  return created;
}

export async function updateRequest(
  id: number,
  changes: Partial<Omit<IntakeWrite, "ID">>,
): Promise<IntakeRequest> {
  const result = await IntakeRequestsService.update(String(id), withRequestStatus(changes));
  if (!result.success) {
    console.error("intake update failed", result.error);
    throw new Error("The change could not be saved.");
  }
  return result.data;
}
