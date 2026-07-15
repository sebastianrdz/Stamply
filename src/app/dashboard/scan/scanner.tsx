"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, XCircle, RotateCcw, Stamp } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "stamp" | "redeem";

interface ScanResult {
  ok: boolean;
  action?: Mode;
  customerName?: string | null;
  programName?: string;
  reward?: string;
  progress?: number;
  goal?: number;
  status?: string;
  type?: string;
  error?: string;
  retryInSeconds?: number;
}

const READER_ID = "stamply-qr-reader";

export function Scanner() {
  const [mode, setMode] = useState<Mode>("stamp");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const modeRef = useRef<Mode>(mode);

  // Keep the latest mode readable inside the scan callback without re-creating it.
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  async function stop() {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* already stopped */
      }
    }
    setScanning(false);
    busyRef.current = false;
  }

  async function submit(barcode: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, action: modeRef.current }),
      });
      const data = (await res.json()) as ScanResult;
      setResult({ ...data, ok: res.ok && data.ok !== false });
    } catch {
      setResult({ ok: false, error: "network" });
    } finally {
      await stop();
    }
  }

  async function start() {
    setResult(null);
    setCameraError(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = scannerRef.current ?? new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    try {
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => void submit(decoded),
        () => {},
      );
    } catch {
      setScanning(false);
      setCameraError(
        "Couldn't access the camera. Grant permission and use HTTPS.",
      );
    }
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <div className="bg-muted grid grid-cols-2 gap-2 rounded-xl p-1">
        {(["stamp", "redeem"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
              mode === m
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "stamp" ? (
              <Stamp className="size-4" />
            ) : (
              <Gift className="size-4" />
            )}
            {m}
          </button>
        ))}
      </div>

      {/* Camera / result */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            id={READER_ID}
            className={cn(
              "aspect-square w-full bg-black",
              !scanning && "hidden",
            )}
          />

          {!scanning && !result && (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <p className="text-muted-foreground text-sm">
                Point the camera at a customer&apos;s loyalty QR to{" "}
                <span className="text-foreground font-medium">{mode}</span>.
              </p>
              <Button size="lg" onClick={start}>
                Start scanning
              </Button>
              {cameraError && (
                <p className="text-destructive text-sm">{cameraError}</p>
              )}
            </div>
          )}

          {result && <ResultView result={result} onNext={start} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultView({
  result,
  onNext,
}: {
  result: ScanResult;
  onNext: () => void;
}) {
  const success = result.ok;
  const rewardReady = result.status === "completed";

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {success ? (
        <div className="bg-success/15 text-success grid size-16 place-items-center rounded-full">
          {result.action === "redeem" ? (
            <Gift className="size-8" />
          ) : (
            <Check className="size-8" strokeWidth={3} />
          )}
        </div>
      ) : (
        <div className="bg-destructive/15 text-destructive grid size-16 place-items-center rounded-full">
          <XCircle className="size-8" />
        </div>
      )}

      {success ? (
        <>
          <div>
            <p className="text-lg font-semibold">
              {result.action === "redeem" ? "Reward redeemed" : "Stamp added"}
            </p>
            {result.customerName && (
              <p className="text-muted-foreground text-sm">
                {result.customerName} · {result.programName}
              </p>
            )}
          </div>
          {result.action === "stamp" &&
            result.progress != null &&
            result.goal != null && (
              <p className="text-2xl font-bold">
                {result.progress}
                <span className="text-muted-foreground">/{result.goal}</span>
              </p>
            )}
          {rewardReady && result.action === "stamp" && (
            <div className="bg-accent/15 text-accent-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
              <Gift className="size-4" />
              Reward ready: {result.reward}
            </div>
          )}
        </>
      ) : (
        <p className="font-medium">{errorMessage(result)}</p>
      )}

      <Button onClick={onNext} variant="outline" className="mt-2 gap-2">
        <RotateCcw className="size-4" />
        Scan next
      </Button>
    </div>
  );
}

function errorMessage(result: ScanResult): string {
  switch (result.error) {
    case "cooldown":
      return `Just scanned — wait ${result.retryInSeconds ?? "a few"}s before stamping again.`;
    case "card_not_found":
      return "This card isn't recognized for your business.";
    case "not_redeemable":
      return "This card doesn't have a reward ready yet.";
    case "unauthorized":
      return "Your session expired. Please sign in again.";
    case "network":
      return "Network error. Try again.";
    default:
      return "Something went wrong. Try again.";
  }
}
