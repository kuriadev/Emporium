"use client";

import { FileWarning, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { CSRF_HEADER, readCsrfToken } from "@/lib/security/csrf";

const MAX_BYTES = 512 * 1024;

/**
 * Bulk price/stock/status update from a CSV (sku, price, stock, status). The server re-validates the
 * file type, size and every row; rows that fail are reported back, valid rows apply in one transaction.
 */
export function CsvImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ updated: number; errors: string[] } | null>(null);

  const upload = async (file: File) => {
    if (!/\.csv$/i.test(file.name)) return toast.error("Choose a .csv file.");
    if (file.size > MAX_BYTES) return toast.error("CSV files must be 512 KB or smaller.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body, credentials: "same-origin", headers: { [CSRF_HEADER]: readCsrfToken() } });
      const json = (await res.json().catch(() => null)) as { ok: boolean; updated?: number; errors?: string[]; error?: string } | null;
      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Import failed. Check the file and try again.");
        return;
      }
      const result = { updated: json.updated ?? 0, errors: json.errors ?? [] };
      if (result.errors.length) setReport(result);
      else toast.success(`Updated ${result.updated} ${result.updated === 1 ? "SKU" : "SKUs"} from ${file.name}`);
      router.refresh();
    } catch {
      toast.error("Network error. Your file was not imported.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()} title="Columns: sku, price, stock, status">
        <Upload className="size-4" aria-hidden /> Import CSV
      </Button>
      <Modal open={!!report} onOpenChange={(o) => !o && setReport(null)} title="Import finished with warnings" description={report ? `${report.updated} rows applied. ${report.errors.length} rows were skipped.` : undefined} className="max-w-[40rem]">
        <ul className="mt-5 max-h-[50dvh] space-y-2 overflow-y-auto text-sm">
          {report?.errors.map((e) => (
            <li key={e} className="flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-2 text-warning">
              <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
              {e}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-subtle">Fix those rows and import the file again. Rows that already applied are safe to re-import.</p>
      </Modal>
    </>
  );
}
