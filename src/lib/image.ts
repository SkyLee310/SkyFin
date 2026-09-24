// Client-side receipt prep (FR-10): decode (Safari reads HEIC natively), shrink to 1600 px on the
// long edge, re-encode as JPEG under 1 MB. The receipts bucket accepts only JPEG up to 2 MB.

export const MAX_EDGE_PX = 1600;
export const TARGET_BYTES = 1_000_000;
const BUCKET_LIMIT_BYTES = 2_097_152;
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

/** Scales width × height down (never up) so the longer edge is at most maxEdge. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE_PX) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Tries each JPEG quality in turn and returns the first result under the target size. */
export async function encodeUnderTarget(
  encode: (quality: number) => Promise<Blob>,
  target = TARGET_BYTES,
): Promise<Blob> {
  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await encode(quality);
    if (blob.size <= target) return blob;
  }
  if (!blob || blob.size > BUCKET_LIMIT_BYTES) throw new Error("This photo is too large to upload.");
  return blob;
}

export async function prepareReceiptImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    // Transparent screenshots would otherwise turn black in JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return await encodeUnderTarget(
      (quality) =>
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the photo."))), "image/jpeg", quality),
        ),
    );
  } finally {
    bitmap.close();
  }
}
