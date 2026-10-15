import { useQuery } from "@tanstack/react-query";
import { IntakeRequestsService, IntakeTasksService } from "../../generated";
import type { RequestorValue } from "../../generated/models/IntakeRequestsModel";
import { odataString, type IntakeRequest } from "@/lib/intake";
import { useAppStore } from "@/lib/store";

export type Person = RequestorValue;

const PERSON_ODATA_TYPE = "#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser";

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  return typeof v === "string" ? v : "";
}

/** Narrow the SharePoint person-field search payload (direct array or { value: [...] }). */
export function parsePeople(payload: unknown): Person[] {
  const raw = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { value?: unknown }).value)
      ? (payload as { value: unknown[] }).value
      : null;
  if (raw === null) throw new Error("Unsupported people response shape");
  return raw.map((item) => {
    if (typeof item !== "object" || item === null) throw new Error("Unsupported person item");
    const o = item as Record<string, unknown>;
    const claims = str(o, "Claims");
    if (!claims) throw new Error("Person item has no Claims");
    return {
      "@odata.type": str(o, "@odata.type") || PERSON_ODATA_TYPE,
      Claims: claims,
      DisplayName: str(o, "DisplayName"),
      Email: str(o, "Email"),
      Picture: str(o, "Picture"),
      Department: str(o, "Department"),
      JobTitle: str(o, "JobTitle"),
    };
  });
}

/** Fresh write payload for the Requestor person column. */
export function personWrite(p: Person): Person {
  return {
    "@odata.type": p["@odata.type"] || PERSON_ODATA_TYPE,
    Claims: p.Claims,
    DisplayName: p.DisplayName,
    Email: p.Email,
    Picture: p.Picture,
    Department: p.Department,
    JobTitle: p.JobTitle,
  };
}

/** Person columns the app can search: request Requestor/Owner, and the task list's Assigned To. */
export type PersonField = "Requestor" | "Owner" | "TaskAssignedTo";

export function usePeopleSearch(term: string, field: PersonField = "Requestor") {
  const t = term.trim();
  return useQuery({
    queryKey: ["people", field, t],
    enabled: t.length >= 2,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result =
        field === "TaskAssignedTo"
          ? await IntakeTasksService.getReferencedEntity(t, "AssignedTo")
          : await IntakeRequestsService.getReferencedEntity(t, field);
      if (!result.success) {
        console.error("people search failed", result.error);
        throw new Error("People search failed.");
      }
      return parsePeople(result.data);
    },
  });
}

/** Requestor display name, from the Requestor person column. */
export function requestorOf(r: IntakeRequest): string | undefined {
  return r.Requestor?.DisplayName || undefined;
}

/** The request's Owner (single SharePoint person), or null when unassigned. */
export function ownerOf(r: IntakeRequest): Person | null {
  return r.Owner?.Claims ? r.Owner : null;
}

export function ownerNames(r: IntakeRequest): string | undefined {
  return r.Owner?.DisplayName || undefined;
}

/** OData filter for "my" requests in the current view, plus whether the view still needs an identity. */
export function useMyRequestScope() {
  const role = useAppStore((s) => s.role);
  const me = useAppStore((s) => s.me);
  if (role === "Manager") return { role, needsIdentity: false, filter: undefined as string | undefined };
  if (!me?.Email) return { role, needsIdentity: true, filter: undefined as string | undefined };
  const column = role === "Assignee" ? "Owner/EMail" : "Requestorsemail";
  return { role, needsIdentity: false, filter: `${column} eq ${odataString(me.Email)}` };
}

