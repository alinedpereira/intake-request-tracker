import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, FolderOpen, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES, TEXT_EXTENSIONS, ensureRequestFolder, fileUrl, folderUrl, isTextFile, uploadRequestFile, useRequestFiles } from "@/lib/files";

function size(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Files for one request, stored in a SharePoint folder named after the request number. */
export function RequestFiles({ requestNo }: { requestNo: string }) {
  const qc = useQueryClient();
  const q = useRequestFiles(requestNo);
  const inputRef = useRef<HTMLInputElement>(null);
  const openFolder = useMutation({
    mutationFn: () => ensureRequestFolder(requestNo),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["request-files", requestNo] }),
    onError: () => toast.error("The file folder could not be prepared. Please try again."),
  });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const failed: string[] = [];
      setProgress({ done: 0, total: files.length });
      for (const [i, f] of files.entries()) {
        try {
          await uploadRequestFile(requestNo, f);
        } catch (e) {
          failed.push(e instanceof Error ? e.message : `${f.name} could not be uploaded.`);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      return { ok: files.length - failed.length, failed };
    },
    onSettled: () => {
      setProgress(null);
      void qc.invalidateQueries({ queryKey: ["request-files", requestNo] });
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) toast.success(ok === 1 ? "File added" : `${ok} files added`);
      failed.forEach((m) => toast.error(m));
    },
    onError: () => toast.error("Files could not be uploaded. Please try again."),
  });
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    const notText = files.filter((f) => !isTextFile(f));
    notText.forEach((f) => toast.error(`${f.name} can't be uploaded here. Use Open folder in SharePoint for PDFs, Office files and images.`));
    const tooBig = files.filter((f) => isTextFile(f) && f.size > MAX_UPLOAD_BYTES);
    tooBig.forEach((f) => toast.error(`${f.name} is larger than 5 MB.`));
    const ok = files.filter((f) => isTextFile(f) && f.size <= MAX_UPLOAD_BYTES);
    if (ok.length) upload.mutate(ok);
  };

  return (
    <section aria-labelledby="files-h" className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-primary bg-accent px-4 py-2 text-accent-foreground">
        <h2 id="files-h" className="font-semibold">Files</h2>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" aria-label="Refresh files" disabled={q.isFetching} onClick={() => void q.refetch()}>
            <RefreshCw aria-hidden="true" className={q.isFetching ? "animate-spin" : undefined} />
          </Button>
          <input
            ref={inputRef}
            id={`file-input-${requestNo}`}
            type="file"
            multiple
            accept={TEXT_EXTENSIONS.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => pick(e.target.files)}
          />
          <Button size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            <Paperclip aria-hidden="true" />
            {progress ? `Uploading ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} of ${progress.total}…` : "Add text files"}
          </Button>
          {q.data?.exists && folderUrl(requestNo) ? (
            <Button asChild size="sm" variant="outline">
              <a href={folderUrl(requestNo)} target="_blank" rel="noopener noreferrer">
                <FolderOpen aria-hidden="true" /> Open folder in SharePoint
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={openFolder.isPending || q.isPending} onClick={() => openFolder.mutate()}>
              <FolderOpen aria-hidden="true" /> {openFolder.isPending ? "Preparing…" : "Prepare SharePoint folder"}
            </Button>
          )}
        </div>
      </div>
      <div className="p-4 text-sm">
        {q.isPending ? (
          <p className="text-muted-foreground">Loading files…</p>
        ) : q.isError ? (
          <p role="alert" className="text-destructive">
            Files could not be loaded. <button type="button" className="underline" onClick={() => void q.refetch()}>Retry</button>
          </p>
        ) : !q.data.exists || q.data.files.length === 0 ? (
          <div
            className="rounded-md border-2 border-dashed border-border p-6 text-center text-muted-foreground"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
          >
            No files yet. Drop .txt, .csv or .json files here (up to 5 MB), or use Open folder in SharePoint for PDFs, Office files and images, then refresh.
          </div>
        ) : (
          <ul
            className="divide-y divide-border"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
          >
            {q.data.files.map((f) => {
              const url = fileUrl(f);
              return (
                <li key={f.Id ?? f.Name} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-primary hover:underline">
                        {f.DisplayName ?? f.Name}
                        <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="truncate">{f.DisplayName ?? f.Name}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{size(f.Size)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
