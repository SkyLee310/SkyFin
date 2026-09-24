"use client";

import React, { useRef } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { createReceiptUpload, parseReceipt } from "@/actions/ai";
import { prepareReceiptImage } from "@/lib/image";
import type { Draft } from "@/lib/validation/schemas";

export type ReceiptStage = { stage: "preparing" } | { stage: "uploading"; percent: number } | { stage: "reading" };

export type ReceiptOutcome =
  | { kind: "draft"; path: string; previewUrl: string; draft: Draft }
  /** Uploaded but not read (daily cap, or the model failed): log it by hand with the photo. */
  | { kind: "manual"; path: string; previewUrl: string; message: string }
  | { kind: "error"; message: string };

interface ReceiptButtonsProps {
  disabled: boolean;
  onStage: (stage: ReceiptStage | null) => void;
  onOutcome: (outcome: ReceiptOutcome) => void;
}

/** PUTs the JPEG to the signed upload URL, reporting progress (fetch can't report upload progress). */
function uploadWithProgress(signedUrl: string, body: Blob, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", "image/jpeg");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(body);
  });
}

/** Camera and gallery buttons for receipt logging (FR-10, F4). */
export function ReceiptButtons({ disabled, onStage, onOutcome }: ReceiptButtonsProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = ""; // so picking the same photo again still fires change
    if (!file) return;

    let previewUrl: string | null = null;
    try {
      onStage({ stage: "preparing" });
      const jpeg = await prepareReceiptImage(file);
      previewUrl = URL.createObjectURL(jpeg);

      const upload = await createReceiptUpload();
      if (!upload.ok) throw new Error(upload.message);
      onStage({ stage: "uploading", percent: 0 });
      await uploadWithProgress(upload.data.signedUrl, jpeg, (percent) => onStage({ stage: "uploading", percent }));

      onStage({ stage: "reading" });
      const res = await parseReceipt({ path: upload.data.path });
      onStage(null);
      if (res.ok) {
        onOutcome({ kind: "draft", path: upload.data.path, previewUrl, draft: res.data.draft });
      } else if (res.code === "AI_LIMIT" || res.code === "AI_FAILED") {
        onOutcome({ kind: "manual", path: upload.data.path, previewUrl, message: res.message });
      } else {
        URL.revokeObjectURL(previewUrl);
        onOutcome({ kind: "error", message: res.message });
      }
    } catch (error) {
      onStage(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onOutcome({ kind: "error", message: error instanceof Error ? error.message : "Couldn't upload the photo." });
    }
  };

  const buttonClass =
    "min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-full disabled:opacity-40 active:scale-95 transition-transform";

  return (
    <>
      <input
        ref={cameraRef}
        id="receipt-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleFile(e.currentTarget)}
      />
      <input
        ref={galleryRef}
        id="receipt-gallery-input"
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleFile(e.currentTarget)}
      />
      <button
        type="button"
        id="btn-receipt-camera"
        aria-label="Snap a receipt"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className={buttonClass}
      >
        <Camera className="w-5 h-5" />
      </button>
      <button
        type="button"
        id="btn-receipt-gallery"
        aria-label="Choose a receipt photo"
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
        className={buttonClass}
      >
        <ImageIcon className="w-5 h-5" />
      </button>
    </>
  );
}
