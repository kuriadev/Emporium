import "server-only";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface LibraryImage {
  src: string;
  label: string;
}

const pretty = (file: string) =>
  file
    .replace(/\.(webp|png|jpe?g)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Images an editor can attach without uploading: bundled product shots plus validated uploads. */
export async function listMediaLibrary(): Promise<LibraryImage[]> {
  const bundled = await readdir(join(process.cwd(), "public", "images", "products")).catch(() => [] as string[]);
  const uploads = await readdir(join(process.cwd(), "data", "uploads")).catch(() => [] as string[]);
  return [
    ...bundled.filter((f) => /^[a-z0-9-]+\.webp$/.test(f)).sort().map((f) => ({ src: `/images/products/${f}`, label: pretty(f) })),
    ...uploads.filter((f) => /^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(f)).map((f) => ({ src: `/media/${f}`, label: "Uploaded image" })),
  ];
}
