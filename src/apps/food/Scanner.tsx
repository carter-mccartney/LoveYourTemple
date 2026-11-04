import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);

/**
 * Live camera barcode scanner (works in Safari and Chrome; the camera needs
 * https or localhost). Falls back to reading a photo, or typing the number.
 */
export function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current!, (result) => {
        if (result && !done.current) {
          done.current = true;
          navigator.vibrate?.(40);
          controls?.stop();
          onCode(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (cancelled) c.stop();
      })
      .catch((e: Error) =>
        setError(
          e.name === "NotAllowedError"
            ? "Camera permission was blocked. Allow the camera for this site, or use a photo / type the number."
            : e.name === "NotFoundError"
              ? "No camera found on this device."
              : `Camera unavailable (${e.message}).`,
        ),
      );
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onCode]);

  async function fromPhoto(file: File) {
    const url = URL.createObjectURL(file);
    try {
      const r = await new BrowserMultiFormatReader(hints).decodeFromImageUrl(url);
      onCode(r.getText());
    } catch {
      setError("Couldn't find a barcode in that photo. Try closer, in good light, with the barcode flat.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="stack tight">
      {!error && (
        <div className="scanner">
          <video ref={video} muted playsInline />
          <div className="scan-frame" aria-hidden="true" />
        </div>
      )}
      {error && <p className="banner error">{error}</p>}
      <div className="row wrap">
        <label className="btn">
          Scan from a photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
        </label>
        <form
          className="row grow"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCode(typed.trim());
          }}
        >
          <input className="input grow" inputMode="numeric" placeholder="or type the barcode number" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))} />
          <button className="btn" disabled={typed.length < 8}>Look up</button>
        </form>
      </div>
    </div>
  );
}
