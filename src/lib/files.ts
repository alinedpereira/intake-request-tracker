import { useQuery } from "@tanstack/react-query";
import { SharePointService } from "../../generated";
import type { BlobMetadata } from "../../generated/models/SharePointModel";
import { safeUrl } from "@/lib/safe-url";

export const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL?.trim().replace(/\/+$/, "") ?? "";
/** The site's "Documents" library. */
const LIBRARY_ID = import.meta.env.VITE_SHAREPOINT_DOCUMENTS_LIBRARY_ID?.trim() ?? "";
const LIBRARY_PATH = "Shared Documents";

function requireSiteUrl(): string {
  const url = safeUrl(SITE_URL);
  if (!url || !url.startsWith("https://")) {
    throw new Error("Set VITE_SHAREPOINT_SITE_URL to your HTTPS SharePoint site URL.");
  }
  return url;
}

/** Folder names are request numbers; keep only safe characters. */
function folderName(requestNo: string): string {
  return requestNo.replace(/[^A-Za-z0-9-]/g, "");
}

export function folderUrl(requestNo: string): string | undefined {
  if (!SITE_URL || !safeUrl(SITE_URL)) return undefined;
  return safeUrl(`${SITE_URL}/${encodeURI(LIBRARY_PATH)}/${encodeURIComponent(folderName(requestNo))}`);
}

export function fileUrl(f: BlobMetadata): string | undefined {
  if (!f.Path || !SITE_URL) return undefined;
  const siteUrl = safeUrl(SITE_URL);
  if (!siteUrl) return undefined;
  const path = f.Path.split("/").map((p) => encodeURIComponent(p)).join("/");
  const site = new URL(siteUrl);
  const baseUrl = path.startsWith("/sites/") ? site.origin : siteUrl;
  return safeUrl(`${baseUrl}${path.startsWith("/sites/") || path.startsWith("/") ? "" : "/"}${path}`);
}

async function getFolderId(requestNo: string): Promise<string | undefined> {
  const siteUrl = requireSiteUrl();
  const res = await SharePointService.GetFolderMetadataByPath(siteUrl, `/${LIBRARY_PATH}/${folderName(requestNo)}`);
  if (!res.success) return undefined;
  return res.data?.Id;
}

/** Creates the request's file folder if it does not exist yet. */
export async function ensureRequestFolder(requestNo: string): Promise<void> {
  const existing = await getFolderId(requestNo);
  if (existing) return;
  if (!LIBRARY_ID) throw new Error("Set VITE_SHAREPOINT_DOCUMENTS_LIBRARY_ID to your SharePoint document library ID.");
  const res = await SharePointService.CreateNewFolder(requireSiteUrl(), LIBRARY_ID, { path: folderName(requestNo) });
  if (!res.success) {
    console.error("folder create failed", res.error);
    throw new Error("The file folder could not be created.");
  }
}

export type FolderState = { exists: false } | { exists: true; files: BlobMetadata[] };

export function useRequestFiles(requestNo: string | undefined) {
  return useQuery({
    queryKey: ["request-files", requestNo],
    enabled: !!requestNo,
    queryFn: async (): Promise<FolderState> => {
      const id = await getFolderId(requestNo as string);
      if (!id) return { exists: false };
      const res = await SharePointService.ListFolder(requireSiteUrl(), id);
      if (!res.success) {
        console.error("folder list failed", res.error);
        throw new Error("Files could not be loaded.");
      }
      const payload: unknown = res.data;
      const rows = Array.isArray(payload)
        ? (payload as BlobMetadata[])
        : typeof payload === "object" && payload !== null && Array.isArray((payload as { value?: unknown }).value)
          ? ((payload as { value: BlobMetadata[] }).value)
          : null;
      if (rows === null) throw new Error("Unsupported folder response.");
      return { exists: true, files: rows.filter((f) => !f.IsFolder) };
    },
  });
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Plain-text types the SharePoint connection can carry unchanged. */
export const TEXT_EXTENSIONS = [".txt", ".csv", ".json", ".md", ".xml", ".log", ".tsv"];

export function isTextFile(f: File): boolean {
  const n = f.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => n.endsWith(ext));
}

/** Keep the user's file name but drop characters SharePoint rejects. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/["*:<>?/\\|#%]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "").trim();
  return cleaned || "file";
}

/**
 * Upload one plain-text file into the request's folder.
 * The connection only carries text bodies, so the file's text is sent as-is.
 * The stored size is checked afterwards; on a mismatch the copy is removed and an error raised.
 */
export async function uploadRequestFile(requestNo: string, file: File): Promise<void> {
  if (!isTextFile(file)) throw new Error(`${file.name} is not a plain-text file. Use Open folder in SharePoint for this file.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
  await ensureRequestFolder(requestNo);
  const text = await file.text();
  const expected = new TextEncoder().encode(text).length;
  const name = safeFileName(file.name);
  const res = await SharePointService.CreateFile(requireSiteUrl(), `/${LIBRARY_PATH}/${folderName(requestNo)}`, name, text);
  if (!res.success) {
    console.error("file upload failed", res.error);
    throw new Error(`${file.name} could not be uploaded.`);
  }
  const stored = res.data?.Size;
  if (typeof stored === "number" && stored !== expected) {
    console.error("uploaded size mismatch", { expected, stored });
    if (res.data?.Id) {
      const del = await SharePointService.DeleteFile(requireSiteUrl(), res.data.Id);
      if (!del.success) console.error("cleanup of bad upload failed", del.error);
    }
    throw new Error(`${file.name} was not stored correctly, so it was removed.`);
  }
}
