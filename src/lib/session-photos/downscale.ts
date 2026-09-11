/**
 * The browser's half of a photo upload (bst-v1.1 issue 4) — taking one photo
 * and turning it into the two blobs the module stores.
 *
 * Why this runs in the browser and not on the server:
 *
 * 1. **The request limit.** Vercel caps a request body; a phone photo is 3–8MB
 *    and a batch of them would sail past any sane cap. A ≤2048px q0.88 copy is
 *    ~0.5–1.5MB and its thumbnail is a few KB, so each upload stays small.
 * 2. **No image processing on the server.** `sharp` would become a runtime
 *    dependency and BST's build budget is a 3.3GB laptop; a canvas does the
 *    same job with zero weight.
 *
 * The trade accepted here, recorded so it is a decision and not an accident:
 * the stored "original" is a high-quality DOWNSCALED copy (long edge 2048px),
 * not the camera's full-resolution file. If a true original is ever needed,
 * that is a presigned direct-to-R2 upload — a new decision, not a tweak.
 *
 * ⚠️ EXIF orientation relies on `createImageBitmap`'s `from-image`; a browser
 * that ignores the option yields sideways photos. No test can prove this —
 * it needs a real phone, and Jericho's eye is the check.
 */

/** The archive copy's long edge. */
export const PHOTO_MAX_EDGE = 2048;
/** The public variant's long edge. */
export const THUMB_MAX_EDGE = 480;

export type PreparedPhoto = {
  /** The archive copy, JPEG. */
  photo: Blob;
  /** The small variant the public site will request, JPEG. */
  thumb: Blob;
  /** A local object URL of the thumbnail, for the review row. */
  previewUrl: string;
};

/**
 * Prepare one picked file; null when it is not an image the browser can read.
 * The caller owns `previewUrl` and should revoke it when the row goes away.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  try {
    const photo = await render(bitmap, PHOTO_MAX_EDGE, 0.88);
    const thumb = await render(bitmap, THUMB_MAX_EDGE, 0.8);
    return { photo, thumb, previewUrl: URL.createObjectURL(thumb) };
  } finally {
    bitmap.close();
  }
}

async function render(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare photos.");

  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("That photo could not be prepared — try it again.");
  return blob;
}
