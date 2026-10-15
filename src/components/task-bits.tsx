import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Trash2, User } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useAppStore } from "@/lib/store";
import { ownerOf, personWrite, type Person } from "@/lib/people";
import { PersonPicker } from "@/components/person-picker";
import { formatDate, requestNumber, useRequestPage, type IntakeRequest } from "@/lib/intake";
import {
  createTask,
  deleteTask,
  isTaskOverdue,
  taskAssigneeName,
  taskStatusOf,
  updateTask,
  useTaskStatuses,
  type IntakeTask,
  type TaskWrite,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskStatusSelect({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const q = useTaskStatuses();
  if (q.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Statuses could not be loaded. <button type="button" className="underline" onClick={() => void q.refetch()}>Retry</button>
      </p>
    );
  return (
    <div className="[&>[data-slot=native-select-wrapper]]:w-full">
      <NativeSelect id={id} aria-label={label} value={value} disabled={q.isPending} onChange={(e) => onChange(e.target.value)} className="bg-card">
        {q.isPending && <NativeSelectOption value={value}>Loading…</NativeSelectOption>}
        {(q.data ?? []).map((c) => (
          <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function useTaskMutations() {
  const qc = useQueryClient();
  const done = () => void qc.invalidateQueries({ queryKey: ["tasks"] });
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: TaskWrite }) => updateTask(id, changes),
    onSuccess: done,
    onError: () => toast.error("The task could not be saved. Please try again."),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => { done(); toast.success("Task deleted"); },
    onError: () => toast.error("The task could not be deleted. Please try again."),
  });
  return { update, remove };
}

export function TaskCard({ task, showRequest = true }: { task: IntakeTask; showRequest?: boolean }) {
  const { update, remove } = useTaskMutations();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const status = taskStatusOf(task);
  const overdue = isTaskOverdue(task);
  return (
    <article className="space-y-2 rounded-md border border-border bg-card p-3 text-sm shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("font-semibold", status === "Done" && "line-through")}>{task.Title}</h3>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={`Edit task ${task.Title}`} onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete task ${task.Title}`}
            disabled={remove.isPending}
            onClick={async () => {
              if (await confirm({ title: "Delete this task?", confirmLabel: "Delete", destructive: true })) remove.mutate(task.ID as number);
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      {showRequest && task.RequestItemId ? (
        <Link to={`/work/${task.RequestItemId}`} className="block truncate text-xs font-medium text-primary hover:underline">
          {task.RequestNumber ?? "Request"} · {task.RequestTitle}
        </Link>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1"><User className="size-3.5" aria-hidden="true" />{taskAssigneeName(task) ?? "Unassigned"}</span>
        <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-red-700 dark:text-red-400")}>
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {task.DueDate ? `Due ${formatDate(task.DueDate)}` : "No due date"}
          {overdue && " · overdue"}
        </span>
      </div>
      {task.TaskNotes && <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{task.TaskNotes}</p>}
      <TaskStatusSelect
        id={`task-status-${task.ID}`}
        label={`Status of ${task.Title}`}
        value={status}
        onChange={(v) => v !== status && update.mutate({ id: task.ID as number, changes: { TaskStatus: { Value: v } } })}
      />
      {editing && <TaskDialog open onOpenChange={setEditing} task={task} />}
    </article>
  );
}

/** Create (optionally pre-linked to a request) or edit a task. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  request,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: IntakeTask;
  request?: IntakeRequest;
}) {
  const qc = useQueryClient();
  const myName = useAppStore((s) => s.myName);
  const me = useAppStore((s) => s.me);
  const role = useAppStore((s) => s.role);
  const [title, setTitle] = useState(task?.Title ?? "");
  const [owner, setOwner] = useState<Person | null>(
    task ? (task.AssignedTo?.Claims ? task.AssignedTo : null) : role === "Assignee" && me ? me : request ? ownerOf(request) : null,
  );
  const [due, setDue] = useState(task?.DueDate ? task.DueDate.slice(0, 10) : "");
  const [status, setStatus] = useState(task ? taskStatusOf(task) : "Not started");
  const [notes, setNotes] = useState(task?.TaskNotes ?? "");
  const [requestId, setRequestId] = useState(task?.RequestItemId ? String(task.RequestItemId) : request?.ID ? String(request.ID) : "");
  const linkedFixed = !!task || !!request;
  const reqs = useRequestPage(undefined, undefined, 200);
  const chosen: IntakeRequest | undefined = request ?? reqs.data?.rows.find((r) => String(r.ID) === requestId);

  const save = useMutation({
    mutationFn: async () => {
      const dueIso = due ? `${due}T12:00:00Z` : undefined;
      if (task) {
        const changes: TaskWrite = {};
        if (title.trim() !== task.Title) changes.Title = title.trim();
        if (owner && owner.Claims !== task.AssignedTo?.Claims) changes.AssignedTo = personWrite(owner);
        if ((task.DueDate?.slice(0, 10) ?? "") !== due) changes.DueDate = dueIso;
        if (status !== taskStatusOf(task)) changes.TaskStatus = { Value: status };
        if (notes.trim() !== (task.TaskNotes ?? "")) changes.TaskNotes = notes.trim();
        if (Object.keys(changes).length === 0) return;
        await updateTask(task.ID as number, changes);
      } else {
        await createTask({
          Title: title.trim(),
          RequestItemId: chosen?.ID,
          RequestNumber: chosen ? requestNumber(chosen) : undefined,
          RequestTitle: chosen?.Title,
          AssignedTo: owner ? personWrite(owner) : undefined,
          DueDate: dueIso,
          TaskStatus: { Value: status },
          TaskNotes: notes.trim() || undefined,
          CreatedByName: myName || role,
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(task ? "Task saved" : "Task added");
      onOpenChange(false);
    },
    onError: () => toast.error("The task could not be saved. Please try again."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form
          id="task-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <F id="t-request" label="Request">
            {linkedFixed ? (
              <p id="t-request" className="text-sm font-semibold">
                {task ? `${task.RequestNumber ?? ""} · ${task.RequestTitle ?? ""}` : `${requestNumber(request as IntakeRequest)} · ${request?.Title}`}
              </p>
            ) : reqs.isError ? (
              <p role="alert" className="text-sm text-destructive">Requests could not be loaded.</p>
            ) : (
              <div className="[&>[data-slot=native-select-wrapper]]:w-full">
                <NativeSelect id="t-request" required value={requestId} disabled={reqs.isPending} onChange={(e) => setRequestId(e.target.value)} className="bg-card">
                  <NativeSelectOption value="">{reqs.isPending ? "Loading requests…" : "Choose a request…"}</NativeSelectOption>
                  {(reqs.data?.rows ?? []).map((r) => (
                    <NativeSelectOption key={r.ID} value={String(r.ID)}>{requestNumber(r)} · {r.Title}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
          </F>
          <F id="t-title" label="Task">
            <Input id="t-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing" />
          </F>
          <div className="grid gap-4 sm:grid-cols-2">
            <F id="t-owner" label="Assigned to">
              <PersonPicker id="t-owner" field="TaskAssignedTo" value={owner} onChange={setOwner} />
            </F>
            <F id="t-due" label="Due date">
              <Input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </F>
          </div>
          <F id="t-status" label="Status">
            <TaskStatusSelect id="t-status" value={status} onChange={setStatus} />
          </F>
          <F id="t-notes" label="Notes">
            <Textarea id="t-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </F>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="task-form" disabled={save.isPending || !title.trim() || (!linkedFixed && !requestId)}>
            {save.isPending ? "Saving…" : task ? "Save task" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
