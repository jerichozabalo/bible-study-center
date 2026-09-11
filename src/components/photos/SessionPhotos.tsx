"use client";

/**
 * The photos card on a meeting record (bst-v1.1 issue 4) — take or upload,
 * review with a caption and a date each, tick consent **once for the batch**,
 * then upload; the night's existing photos sit above with delete.
 *
 * Two rules the UI keeps visible rather than hiding:
 *
 * 1. **One consent tick per batch.** The module refuses a batch without it, and
 *    the checkbox is where the recorded moment starts — it is not a per-photo
 *    switch (there is deliberately no such thing).
 * 2. **Uploading needs a connection.** There is no photo outbox — #72's queue
 *    is for attendance — so offline the buttons are held and say why, the same
 *    pattern the sheet's add-someone flow uses (QA, 2026-09-04).
 *
 * The thumbnails come in as short-lived signed URLs, so a plain <img> is right
 * here: next/image would need a remotePatterns entry for a URL that changes
 * every visit (the `Emblem.tsx` reasoning, one level up).
 *
 * The file input opens the phone's own picker — camera AND gallery (no
 * `capture` attribute; with it, Android offers the camera only, which Jericho
 * hit on 2026-09-11).
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { deletePhotoAction, uploadPhotoAction } from "@/lib/session-photos/actions";
import { preparePhoto } from "@/lib/session-photos/downscale";
import type { SignedPhoto } from "@/lib/session-photos/photos";
import { formatLongDate } from "@/lib/dates";

const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";
const INPUT =
  "h-[44px] w-full rounded-[13px] border-[1.5px] border-line bg-card px-[11px] text-[14px] font-semibold text-ink placeholder:font-normal placeholder:text-[#968871b0]";

type Item = {
  key: string;
  name: string;
  photo: Blob;
  thumb: Blob;
  previewUrl: string;
  caption: string;
  takenOn: string;
  status: "ready" | "uploading" | "done" | "failed";
  error?: string;
};

export function SessionPhotos({
  meetingId,
  meetingDate,
  photos,
  storageReady,
}: {
  meetingId: string;
  /** `YYYY-MM-DD` — what a photo taken tonight defaults to. */
  meetingDate: string;
  /** Signed, short-lived URLs for the night's photos. */
  photos: SignedPhoto[];
  /** Whether the R2 keys are present at all. */
  storageReady: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Uploading and deleting are server round trips with no queue — offline the
  // controls are held rather than allowed to crash the page.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPreparing(true);
    setNotice(null);

    const prepared: Item[] = [];
    let skipped = 0;
    for (const file of Array.from(list)) {
      try {
        const photo = await preparePhoto(file);
        if (!photo) {
          skipped += 1;
          continue;
        }
        prepared.push({
          key: `${file.name}-${prepared.length}-${Date.now()}`,
          name: file.name,
          photo: photo.photo,
          thumb: photo.thumb,
          previewUrl: photo.previewUrl,
          caption: "",
          takenOn: meetingDate,
          status: "ready",
        });
      } catch {
        skipped += 1;
      }
    }

    setItems((current) => [...current, ...prepared]);
    setPreparing(false);
    if (skipped > 0) setNotice("Some files were not photos and were skipped.");
    if (fileInput.current) fileInput.current.value = "";
  }

  function dropItem(key: string) {
    setItems((current) => {
      const gone = current.find((item) => item.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  }

  function closeBatch() {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
    setItems([]);
    setConsent(false);
    setAdding(false);
    setNotice(null);
  }

  async function uploadAll() {
    setBusy(true);
    setNotice(null);
    let uploaded = 0;

    for (const item of items) {
      if (item.status === "done") continue;
      setItems((current) =>
        current.map((i) => (i.key === item.key ? { ...i, status: "uploading" } : i)),
      );

      const formData = new FormData();
      formData.set("meetingId", meetingId);
      formData.set("caption", item.caption);
      formData.set("takenOn", item.takenOn);
      if (consent) formData.set("consent", "on");
      formData.set("photo", new File([item.photo], "photo.jpg", { type: "image/jpeg" }));
      formData.set("thumb", new File([item.thumb], "thumb.jpg", { type: "image/jpeg" }));

      let error: string | null = null;
      try {
        const result = await uploadPhotoAction(formData);
        if (result.uploaded) uploaded += 1;
        else error = result.error ?? "That photo could not be uploaded.";
      } catch {
        error = "That photo could not be uploaded — try it again.";
      }

      setItems((current) =>
        current.map((i) =>
          i.key === item.key
            ? error === null
              ? { ...i, status: "done" as const }
              : { ...i, status: "failed" as const, error }
            : i,
        ),
      );
    }

    setBusy(false);

    if (uploaded > 0) {
      setItems((current) => {
        for (const item of current) {
          if (item.status === "done") URL.revokeObjectURL(item.previewUrl);
        }
        return current.filter((item) => item.status !== "done");
      });
      setConsent(false);
      setNotice(`${uploaded} ${uploaded === 1 ? "photo" : "photos"} uploaded.`);
      router.refresh();
    }
  }

  async function removePhoto(photoId: string) {
    setDeleting(photoId);
    setNotice(null);

    const formData = new FormData();
    formData.set("photoId", photoId);
    formData.set("meetingId", meetingId);

    const result = await deletePhotoAction(formData);
    setDeleting(null);
    if (result.deleted) {
      router.refresh();
    } else {
      setNotice(result.error ?? "That photo could not be deleted.");
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-[11px] flex items-baseline justify-between">
        <h3 className="text-[18px]">Photos</h3>
        {photos.length === 0 ? null : (
          <span className="text-[13px] font-semibold text-tan">{photos.length}</span>
        )}
      </div>

      {storageReady ? null : (
        <p className="rounded-[20px] border-[1.5px] border-line bg-card px-4 py-[14px] text-[14px] leading-[1.45] text-slate">
          Photo storage is not set up yet. Once the R2 keys are in place this card takes photos —
          from the camera or the gallery — and keeps them on this session&apos;s record.
        </p>
      )}

      {storageReady ? (
        <>
          {photos.length === 0 ? (
            <p className="rounded-[20px] border-[1.5px] border-line bg-card px-4 py-[14px] text-[14px] leading-[1.45] text-slate">
              No photos on this night yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-[9px]">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-[18px] border border-line bg-card"
                >
                  <a href={photo.photoUrl} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed R2 URL, rotates every visit */}
                    <img
                      src={photo.thumbUrl}
                      alt={photo.caption ?? "Session photo"}
                      className="h-[118px] w-full object-cover"
                    />
                  </a>
                  <div className="px-[11px] py-[9px]">
                    <div className="text-[13px] font-semibold">{formatLongDate(photo.takenOn)}</div>
                    {photo.caption === null ? null : (
                      <div className="mt-[2px] truncate text-[12.5px] text-slate">
                        {photo.caption}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo.id)}
                      disabled={deleting !== null || !online}
                      className="mt-[7px] text-[12.5px] font-bold text-amber-ink disabled:opacity-50"
                    >
                      {deleting === photo.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notice === null ? null : (
            <p className="mt-3 rounded-[16px] bg-blue-tint px-4 py-[11px] text-[13.5px] leading-[1.45] text-blue-deep">
              {notice}
            </p>
          )}

          {adding ? (
            <div className="mt-3 rounded-[20px] border-[1.5px] border-line bg-card p-[14px]">
              {online ? null : (
                <p className="mb-[11px] rounded-[14px] bg-shell px-3 py-[9px] text-[12.5px] leading-[1.45] text-slate">
                  Uploading needs a connection. The photos you pick here stay on this screen until
                  there is signal.
                </p>
              )}

              <label className={EYEBROW} htmlFor="photo-files">
                TAKE OR CHOOSE PHOTOS
              </label>
              <input
                id="photo-files"
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void onFiles(event.target.files)}
                disabled={preparing || busy}
                className="mt-[8px] block w-full text-[14px] text-slate file:mr-[10px] file:rounded-[12px] file:border-0 file:bg-blue file:px-[14px] file:py-[10px] file:text-[13.5px] file:font-bold file:text-white disabled:opacity-60"
              />
              {preparing ? (
                <p className="mt-[9px] text-[12.5px] text-tan">Preparing…</p>
              ) : null}

              {items.length === 0 ? null : (
                <div className="mt-[11px] flex flex-col gap-[9px]">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start gap-[10px] rounded-[16px] border border-line bg-[#FBF9F5] p-[10px]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never leaves the phone */}
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-[54px] w-[54px] shrink-0 rounded-[12px] object-cover"
                      />
                      <div className="min-w-0 grow">
                        <input
                          value={item.caption}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((i) =>
                                i.key === item.key ? { ...i, caption: event.target.value } : i,
                              ),
                            )
                          }
                          placeholder="Caption (optional)"
                          onKeyDown={(event) => {
                            // The card lives inside the sheet's form now; Enter in
                            // here would submit the SHEET. The ride-along search
                            // uses the same guard.
                            if (event.key === "Enter") event.preventDefault();
                          }}
                          disabled={item.status === "uploading"}
                          className={INPUT}
                        />
                        <input
                          type="date"
                          value={item.takenOn}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((i) =>
                                i.key === item.key ? { ...i, takenOn: event.target.value } : i,
                              ),
                            )
                          }
                          aria-label="The day the photo was taken"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.preventDefault();
                          }}
                          disabled={item.status === "uploading"}
                          className={`${INPUT} mt-[6px]`}
                        />
                        {item.status === "failed" ? (
                          <p className="mt-[5px] text-[12.5px] leading-[1.4] text-amber-ink">
                            {item.error}
                          </p>
                        ) : null}
                        {item.status === "done" ? (
                          <p className="mt-[5px] text-[12.5px] text-blue-deep">Uploaded.</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => dropItem(item.key)}
                        disabled={busy || item.status === "uploading"}
                        className="shrink-0 text-[13px] font-bold text-tan disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-[12px] flex items-start gap-[11px] rounded-[16px] border-[1.5px] border-line bg-card px-[13px] py-[12px] text-[14px] leading-[1.4] font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  disabled={busy}
                  className="mt-[2px] h-[20px] w-[20px] shrink-0 accent-blue"
                />
                I got everyone&apos;s consent to use these on the website.
              </label>

              <div className="mt-[10px] flex gap-[8px]">
                <button
                  type="button"
                  onClick={() => void uploadAll()}
                  disabled={busy || preparing || items.length === 0 || !consent || !online}
                  className="flex h-[50px] grow items-center justify-center rounded-[16px] bg-blue text-[15.5px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
                >
                  {busy
                    ? "Uploading…"
                    : `Upload ${items.length === 0 ? "" : items.length}`.trim()}
                </button>
                <button
                  type="button"
                  onClick={closeBatch}
                  disabled={busy}
                  className="flex h-[50px] shrink-0 items-center justify-center rounded-[16px] border-[1.5px] border-line px-4 text-[15.5px] font-bold text-slate active:bg-shell disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 flex w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-stone bg-card px-3 py-[14px]"
            >
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] bg-shell">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#61708A"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 8h2.6l1.7-2.6h7.4L17.4 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
                  <circle cx="12" cy="13" r="3.4" />
                </svg>
              </span>
              <span className="text-left">
                <span className="block text-[15.5px] font-bold">Add photos</span>
                <span className="mt-[2px] block text-[13px] text-slate">
                  Take one now, or choose from this phone
                </span>
              </span>
            </button>
          )}
        </>
      ) : null}
    </section>
  );
}
