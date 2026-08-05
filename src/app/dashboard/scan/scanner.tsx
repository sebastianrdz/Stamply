"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, XCircle, RotateCcw, Stamp } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/provider";
import { interpolate } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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
  const dict = useTranslations();
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
      setCameraError(dict.dashboard.scan.cameraError);
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
            {m === "stamp"
              ? dict.dashboard.scan.modeStamp
              : dict.dashboard.scan.modeRedeem}
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
                {interpolate(dict.dashboard.scan.pointCameraHint, {
                  mode:
                    mode === "stamp"
                      ? dict.dashboard.scan.modeStamp
                      : dict.dashboard.scan.modeRedeem,
                })}
              </p>
              <Button size="lg" onClick={start}>
                {dict.dashboard.scan.startScanning}
              </Button>
              {cameraError && (
                <p className="text-destructive text-sm">{cameraError}</p>
              )}
            </div>
          )}

          {result && <ResultView result={result} dict={dict} onNext={start} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultView({
  result,
  dict,
  onNext,
}: {
  result: ScanResult;
  dict: Dictionary;
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
              {result.action === "redeem"
                ? dict.dashboard.scan.rewardRedeemed
                : dict.dashboard.scan.stampAdded}
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
              {interpolate(dict.dashboard.scan.rewardReady, {
                reward: result.reward ?? "",
              })}
            </div>
          )}
        </>
      ) : (
        <p className="font-medium">{errorMessage(result, dict)}</p>
      )}

      <Button onClick={onNext} variant="outline" className="mt-2 gap-2">
        <RotateCcw className="size-4" />
        {dict.dashboard.scan.scanNext}
      </Button>
    </div>
  );
}

function errorMessage(result: ScanResult, dict: Dictionary): string {
  switch (result.error) {
    case "cooldown":
      return interpolate(dict.dashboard.scan.errors.cooldown, {
        seconds:
          result.retryInSeconds ?? dict.dashboard.scan.errors.cooldownFallback,
      });
    case "card_not_found":
      return dict.dashboard.scan.errors.cardNotFound;
    case "not_redeemable":
      return dict.dashboard.scan.errors.notRedeemable;
    case "unauthorized":
      return dict.dashboard.scan.errors.unauthorized;
    case "network":
      return dict.dashboard.scan.errors.network;
    default:
      return dict.dashboard.scan.errors.generic;
  }
}
