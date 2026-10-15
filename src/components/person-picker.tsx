import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePeopleSearch, type Person, type PersonField } from "@/lib/people";
import { cn } from "@/lib/utils";

/** Search-and-pick a SharePoint person for the Requestor column. */
export function PersonPicker({
  id,
  value,
  onChange,
  required,
  className,
  field = "Requestor",
}: {
  id: string;
  value: Person | null;
  onChange: (p: Person | null) => void;
  required?: boolean;
  className?: string;
  field?: PersonField;
}) {
  /** Owner and task Assigned To pickers show the full name only. */
  const showEmail = field === "Requestor";
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(t);
  }, [term]);
  const q = usePeopleSearch(debounced, field);
  const results = q.data ?? [];

  if (value)
    return (
      <div className={cn("flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm", className)}>
        <span className="min-w-0 truncate">
          <span id={id} className="font-medium">{value.DisplayName}</span>
          {showEmail && value.Email && <span className="text-muted-foreground"> · {value.Email}</span>}
        </span>
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Remove ${value.DisplayName}`} onClick={() => onChange(null)}>
          <X aria-hidden="true" />
        </Button>
      </div>
    );

  const pick = (p: Person) => {
    onChange(p);
    setTerm("");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && debounced.trim().length >= 2}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        value={term}
        placeholder="Start typing a name and pick from the list"
        autoComplete="off"
        className="bg-card"
        onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open) { e.preventDefault(); pick(results[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && debounced.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md">
          {q.isFetching && !results.length ? (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          ) : q.isError ? (
            <li className="px-3 py-2 text-destructive">People search failed. Try again.</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No people found.</li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.Claims}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded px-3 py-2", i === active && "bg-accent text-accent-foreground")}
              >
                <span className="font-medium">{p.DisplayName}</span>
                {showEmail && p.Email && <span className="block text-xs text-muted-foreground">{p.Email}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
