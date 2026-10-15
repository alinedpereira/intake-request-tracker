import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useChoices, type ChoiceField } from "@/lib/intake";

export function ChoiceSelect({
  id,
  field,
  value,
  onChange,
  required,
  placeholder = "Choose…",
  disabled,
}: {
  id: string;
  field: ChoiceField;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const q = useChoices(field);
  if (q.isError)
    return (
      <p id={id} role="alert" className="text-sm text-destructive">
        Options could not be loaded.{" "}
        <button type="button" className="underline" onClick={() => void q.refetch()}>
          Retry
        </button>
      </p>
    );
  return (
    <div className="[&>[data-slot=native-select-wrapper]]:w-full">
      <NativeSelect
        id={id}
        value={value}
        required={required}
        disabled={disabled || q.isPending}
        onChange={(e) => onChange(e.target.value)}
        className="bg-card"
      >
        <NativeSelectOption value="">{q.isPending ? "Loading options…" : placeholder}</NativeSelectOption>
        {(q.data ?? []).map((c) => (
          <NativeSelectOption key={c} value={c}>
            {c}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {q.isSuccess && q.data.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No options are configured.</p>}
    </div>
  );
}
