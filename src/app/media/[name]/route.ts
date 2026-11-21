import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "@/server/data-dir";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const match = /^[0-9a-f-]{36}\.(png|jpg|webp)$/.exec(name);
  if (!match) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(join(dataDir(), "uploads", name));
    return new Response(data, {
      headers: {
        "Content-Type": TYPES[match[1]!]!,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
