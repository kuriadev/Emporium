import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guards";
import { validateImageUpload } from "@/server/security/image";
import { handler, jsonError } from "@/server/security/route";
import { writeAudit } from "@/server/services/audit";

export const POST = handler(
  "admin.upload",
  async (req) => {
    const admin = await requireAdmin("catalog:write");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, "Attach an image.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageUpload(bytes, file.type);
    if (!check.ok) return jsonError(415, check.error);

    const name = `${randomUUID()}.${check.kind === "jpeg" ? "jpg" : check.kind}`;
    const dir = join(process.cwd(), "data", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), bytes, { mode: 0o644 });
    writeAudit({ actor: admin, action: "media.upload", entityType: "media", entityId: name, after: { width: check.width, height: check.height, bytes: bytes.byteLength } });

    return NextResponse.json({ ok: true, src: `/media/${name}`, width: check.width, height: check.height });
  },
  { mutation: true },
);
