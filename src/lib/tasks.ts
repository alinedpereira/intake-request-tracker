import { useQuery } from "@tanstack/react-query";
import { IntakeRequestsService, IntakeTasksService } from "../../generated";
import type { IntakeTasksRead, IntakeTasksWrite } from "../../generated/models/IntakeTasksModel";
import { odataString, parseChoices } from "@/lib/intake";

export type IntakeTask = IntakeTasksRead;
export type TaskWrite = Partial<Omit<IntakeTasksWrite, "ID">>;

export const TASK_SELECT = [
  "ID",
  "Title",
  "RequestItemId",
  "RequestNumber",
  "RequestTitle",
  "AssignedTo",
  "DueDate",
  "TaskStatus",
  "TaskNotes",
  "CreatedByName",
  "Modified",
];

export const TASK_PAGE = 100;

export function taskStatusOf(t: IntakeTask): string {
  return t.TaskStatus?.Value ?? "Not started";
}

export function isTaskOverdue(t: IntakeTask): boolean {
  if (!t.DueDate || taskStatusOf(t) === "Done") return false;
  return new Date(t.DueDate).getTime() < Date.now();
}

export function useTaskStatuses() {
  return useQuery({
    queryKey: ["task-choices", "TaskStatus"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const result = await IntakeTasksService.getReferencedEntity("", "TaskStatus");
      if (!result.success) {
        console.error("task status options failed", result.error);
        throw new Error("Unable to load task statuses.");
      }
      return parseChoices(result.data);
    },
  });
}

export function useTaskPage(filter: string | undefined, skipToken: string | undefined, top = TASK_PAGE) {
  return useQuery({
    queryKey: ["tasks", { filter, skipToken, top }],
    queryFn: async () => {
      const result = await IntakeTasksService.getAll({
        select: TASK_SELECT,
        filter,
        orderBy: ["ID desc"],
        top,
        skipToken,
      });
      if (!result.success) {
        console.error("task list load failed", result.error);
        throw new Error("Unable to load tasks.");
      }
      return { rows: result.data ?? [], nextToken: result.skipToken?.trim() || undefined };
    },
  });
}

export async function createTask(record: Omit<IntakeTasksWrite, "ID">): Promise<IntakeTask> {
  const result = await IntakeTasksService.create(record);
  if (!result.success) {
    console.error("task create failed", result.error);
    throw new Error("The task could not be created.");
  }
  return result.data;
}

export async function updateTask(id: number, changes: TaskWrite): Promise<IntakeTask> {
  const result = await IntakeTasksService.update(String(id), changes);
  if (!result.success) {
    console.error("task update failed", result.error);
    throw new Error("The task could not be saved.");
  }
  return result.data;
}

export async function deleteTask(id: number): Promise<void> {
  try {
    await IntakeTasksService.delete(String(id));
  } catch (e) {
    console.error("task delete failed", e);
    throw new Error("The task could not be deleted.");
  }
}

/** Display name of the task's Assigned To person. */
export function taskAssigneeName(t: IntakeTask): string | undefined {
  return t.AssignedTo?.DisplayName || undefined;
}

/** Most owned requests folded into one task filter; beyond this the scope is disclosed as partial. */
export const OWNED_REQUEST_CAP = 100;

/**
 * Assignee scope for tasks: tasks Assigned To the person, or linked to a request they Own.
 * Returns the OData filter once the owned-request ids are known.
 */
export function useAssigneeTaskScope(email: string | undefined) {
  const owned = useQuery({
    queryKey: ["owned-request-ids", email],
    enabled: !!email,
    queryFn: async () => {
      const result = await IntakeRequestsService.getAll({
        select: ["ID"],
        filter: `Owner/EMail eq ${odataString(email as string)}`,
        top: OWNED_REQUEST_CAP,
      });
      if (!result.success) {
        console.error("owned requests load failed", result.error);
        throw new Error("Unable to load owned requests.");
      }
      const ids = (result.data ?? []).map((r) => r.ID).filter((id): id is number => typeof id === "number");
      return { ids, partial: !!result.skipToken?.trim() };
    },
  });
  const filter =
    email && owned.data
      ? [`AssignedTo/EMail eq ${odataString(email)}`, ...owned.data.ids.map((id) => `RequestItemId eq ${id}`)].join(" or ")
      : undefined;
  return { owned, filter, partial: owned.data?.partial ?? false };
}
