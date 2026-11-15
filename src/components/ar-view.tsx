"use client";
import { useEffect, useRef, useState } from "react";
import { useCompass } from "@/lib/client/compass";
import { turnFor } from "@/lib/floor/bearing";

export type ArGuidance = {
  /** Degrees between where the camera looks and where to go: 0 = straight ahead, negative = left. Null = no arrow, show `symbol`. */
  offset: number | null;
  symbol?: "down" | "arrived";
  /** Big line at the top: "Turn left". */
  caption: string;
  /** Smaller line under it: "43 m to South-east staircase". */
  detail?: string;
};

type Props = {
  /** What to show for the phone's current compass heading (null when the phone has no compass or it was refused). */
  guide: (heading: number | null) => ArGuidance;
  /** Called with the text of a QR code the camera sees, and the heading at that moment. Leave out to not scan. */
  onScan?: (text: string, heading: number | null) => void;
  /** An extra button over the picture, offered only when the compass is working. */
  action?: (heading: number) => { label: string; run: () => void } | null;
  /** First line on the start screen. */
  intro: string;
  /** What the arrow falls back to without a compass: "arrow shows this step's turn". */
  withoutCompass: string;
  className?: string;
};

// Not in TypeScript's DOM types yet. Chrome on Android has it; Safari does not.
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

const SCAN_EVERY_MS = 500;
const SAME_CODE_AGAIN_MS = 4000;

/**
 * The camera picture with an arrow laid on the floor ahead. It owns the camera, the compass and (optionally)
 * the QR scanner; the caller decides where the arrow points. The picture never leaves the phone.
 */
export function ArView({ guide, onScan, action, intro, withoutCompass, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { heading, status, start } = useCompass();
  const [camera, setCamera] = useState<"off" | "on" | "blocked">("off");
  const [canScan, setCanScan] = useState(true);

  // The scanner runs on a timer, outside React's render: it reads the latest heading and callback from here.
  const latest = useRef({ heading, onScan });
  useEffect(() => {
    latest.current = { heading, onScan };
  });

  useEffect(() => {
    if (camera !== "on") return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCamera("blocked"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  const scanning = camera === "on" && onScan !== undefined;
  useEffect(() => {
    if (!scanning) return;
    const BarcodeDetector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (!BarcodeDetector) {
      const unsupported = setTimeout(() => setCanScan(false), 0);
      return () => clearTimeout(unsupported);
    }
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    let last = { text: "", at: 0 };
    const timer = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const [code] = await detector.detect(video).catch(() => []);
      if (!code) return;
      const now = Date.now();
      if (code.rawValue === last.text && now - last.at < SAME_CODE_AGAIN_MS) return; // still pointing at the same code
      last = { text: code.rawValue, at: now };
      latest.current.onScan?.(code.rawValue, latest.current.heading);
    }, SCAN_EVERY_MS);
    return () => clearInterval(timer);
  }, [scanning]);

  const frame = `relative isolate overflow-hidden bg-neutral-900 text-white ${className ?? "h-80 w-full"}`;

  if (camera === "off") {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 p-4 text-center`}>
        <p className="text-lg font-bold">{intro}</p>
        <button
          type="button"
          className="min-h-14 rounded-xl bg-yellow-300 px-5 text-xl font-extrabold text-black"
          onClick={() => {
            // Both are asked for from this tap: iPhones refuse the compass otherwise.
            void start();
            setCamera("on");
          }}
        >
          Turn on camera and compass
        </button>
        <p className="text-sm">The picture stays on your phone. Nothing is recorded or sent.</p>
      </div>
    );
  }

  const compass = status === "on" && heading !== null ? heading : null;
  const { offset, symbol, caption, detail } = guide(compass);
  const onCourse = offset !== null && turnFor(offset) === "straight";
  const extra = compass !== null ? action?.(compass) : null;

  // One short line for whatever is missing, so it never covers the arrow.
  const limits = [
    camera === "blocked" ? "No camera (allow it for this site)" : "",
    scanning && !canScan ? "This browser can't scan QR codes here: use the button below" : "",
    status === "denied" ? `No compass allowed: ${withoutCompass}` : status === "unavailable" ? `No compass here: ${withoutCompass}` : compass === null ? "Finding the compass…" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={frame}>
      {camera === "on" ? <video ref={videoRef} autoPlay playsInline muted aria-hidden="true" className="absolute inset-0 size-full object-cover" /> : null}

      {/* The floor: a plane tipped away from the viewer, with the arrow turning on it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[24%] bottom-[16%] [perspective:420px]">
        <div className="absolute inset-0 origin-bottom [transform:rotateX(50deg)]">
          {offset === null ? (
            <p className="absolute inset-x-0 bottom-1/4 text-center text-8xl font-black text-yellow-300 drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
              {symbol === "down" ? "↓" : symbol === "arrived" ? "✓" : "●"}
            </p>
          ) : (
            <svg
              viewBox="0 0 100 160"
              className="absolute bottom-0 left-1/2 h-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.9)] transition-transform duration-150"
              style={{ transform: `translateX(-50%) rotate(${offset}deg)`, transformOrigin: "50% 50%" }}
            >
              <g fill={onCourse ? "#22c55e" : "#fde047"} stroke="#111827" strokeWidth="3" strokeLinejoin="round">
                <path d="M50 4 92 58H68v24H32V58H8z" />
                <path d="M32 92h36v20H32z" opacity="0.8">
                  <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
                </path>
                <path d="M32 122h36v20H32z" opacity="0.5">
                  <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.2s" repeatCount="indefinite" />
                </path>
              </g>
            </svg>
          )}
        </div>
      </div>

      <p role="status" className="absolute inset-x-2 top-2 rounded-lg bg-black/80 px-3 py-2 text-center text-xl font-extrabold">
        <span className={onCourse || symbol === "arrived" ? "text-green-400" : "text-yellow-300"}>{caption}</span>
        {detail ? <span className="block text-base font-bold text-white">{detail}</span> : null}
      </p>

      <div className="absolute inset-x-2 bottom-2 flex flex-col items-center gap-1 text-center text-xs font-bold sm:text-sm">
        {extra ? (
          <button type="button" className="min-h-11 rounded-lg bg-black/80 px-3" onClick={extra.run}>
            {extra.label}
          </button>
        ) : null}
        {limits ? <p className="rounded-lg bg-black/80 px-3 py-1.5">{limits}</p> : null}
      </div>
    </div>
  );
}
