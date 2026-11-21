export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 6000;
export const MIN_DIMENSION = 200;

export type ImageKind = "png" | "jpeg" | "webp";

export const MIME_BY_KIND: Record<ImageKind, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Identifies the format from magic bytes; the client-declared MIME type is never trusted on its own. */
export function sniffImage(buf: Uint8Array): ImageKind | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export function imageDimensions(buf: Uint8Array, kind: ImageKind): { width: number; height: number } | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    if (kind === "png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (kind === "webp") {
      const chunk = String.fromCharCode(...buf.slice(12, 16));
      if (chunk === "VP8X") return { width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (view.getUint32(27, true) & 0xffffff) };
      if (chunk === "VP8L") {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      return null;
    }
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1]!;
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + length;
    }
  } catch {
    return null;
  }
  return null;
}

export type ImageValidation = { ok: true; kind: ImageKind; width: number; height: number } | { ok: false; error: string };

export function validateImageUpload(buf: Uint8Array, declaredType: string): ImageValidation {
  if (buf.byteLength === 0) return { ok: false, error: "The file is empty." };
  if (buf.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "Images must be 5 MB or smaller." };
  const kind = sniffImage(buf);
  if (!kind) return { ok: false, error: "Only PNG, JPEG or WebP images are allowed." };
  if (declaredType && declaredType !== MIME_BY_KIND[kind]) return { ok: false, error: "File type does not match its contents." };
  const dims = imageDimensions(buf, kind);
  if (!dims) return { ok: false, error: "Could not read image dimensions." };
  if (dims.width < MIN_DIMENSION || dims.height < MIN_DIMENSION) return { ok: false, error: `Images must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}.` };
  if (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION) return { ok: false, error: `Images must be at most ${MAX_DIMENSION}×${MAX_DIMENSION}.` };
  return { ok: true, kind, ...dims };
}
