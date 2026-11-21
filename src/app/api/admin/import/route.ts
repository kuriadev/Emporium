import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/security/csv";
import { csvProductRowSchema } from "@/lib/validations/admin";
import { requireAdmin } from "@/server/auth/guards";
import { handler, jsonError } from "@/server/security/route";
import { applyCsvRows } from "@/server/services/admin";

const MAX_CSV_BYTES = 512 * 1024;

export const POST = handler(
  "admin.import",
  async (req) => {
    const admin = await requireAdmin("catalog:write");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Attach a CSV file.");
    if (file.size > MAX_CSV_BYTES) return jsonError(413, "CSV must be 512 KB or smaller.");
    if (!/\.csv$/i.test(file.name)) return jsonError(415, "Only .csv files are accepted.");

    const rows = parseCsv(await file.text(), 2000);
    const [header, ...body] = rows;
    if (!header) return jsonError(400, "The CSV is empty.");
    const cols = header.map((h) => h.trim().toLowerCase());
    const idx = (name: string) => cols.indexOf(name);
    if (idx("sku") < 0) return jsonError(400, "A 'sku' column is required (optional: price, stock, status).");

    const valid: { sku: string; price?: number | ""; stock?: number | ""; status?: string }[] = [];
    const errors: string[] = [];
    body.forEach((r, i) => {
      const get = (n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? "").trim() : "");
      const parsed = csvProductRowSchema.safeParse({ sku: get("sku"), price: get("price"), stock: get("stock"), status: get("status") });
      if (parsed.success) valid.push(parsed.data);
      else errors.push(`Row ${i + 2}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
    });

    const result = applyCsvRows(admin, valid);
    return NextResponse.json({ ok: true, updated: result.updated, errors: [...errors, ...result.errors].slice(0, 50) });
  },
  { mutation: true },
);
