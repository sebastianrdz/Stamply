"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Gift,
  XCircle,
  RotateCcw,
  Stamp,
  Minus,
  Plus,
} from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@stamply/ui/button";
import { Card, CardContent } from "@stamply/ui/card";
import { cn } from "@stamply/ui/utils";
import { useTranslations } from "@stamply/i18n/provider";
import { interpolate } from "@stamply/i18n/format";
import type { Dictionary } from "@stamply/i18n/dictionaries";

type Mode = "stamp" | "redeem";

// Mirrors the fields scanner.tsx needs from the `StandaloneReward` shape in
// src/lib/rewards/queries.ts (only that file imports "server-only", so we
// duplicate the shape here rather than import it into this client component).
interface StandaloneRewardItem {
  id: string;
  title: string;
  status: "available" | "redeemed" | "expired";
  isAvailableNow: boolean;
}

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
  detail?: string;
  code?: string;
  retryInSeconds?: number;
  standaloneRewards?: StandaloneRewardItem[];
}

const READER_ID = "stamply-qr-reader";

// Html5QrcodeScannerState (from html5-qrcode): NOT_STARTED=1, SCANNING=2,
// PAUSED=3. Kept as literals so this module doesn't statically import the
// camera lib (it's loaded lazily in start()).
const SCANNER_SCANNING = 2;
const SCANNER_PAUSED = 3;

/**
 * Stop the scanner safely. html5-qrcode's stop() THROWS synchronously
 * ("Cannot stop, scanner is not running or paused.") when the scanner isn't
 * running/paused — a plain `.stop().catch()` only handles the async rejection,
 * so that sync throw would escape (e.g. the unmount cleanup firing after a scan
 * already stopped the camera). Guard on state and swallow both failure modes.
 */
async function stopScanner(scanner: Html5Qrcode | null): Promise<void> {
  if (!scanner) return;
  const state = scanner.getState();
  if (state !== SCANNER_SCANNING && state !== SCANNER_PAUSED) return;
  try {
    await scanner.stop();
  } catch {
    /* already stopped / mid-teardown */
  }
}

export function Scanner() {
  const dict = useTranslations();
  const [mode, setMode] = useState<Mode>("stamp");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // The barcode from the scan that produced the current `result` — threaded
  // down to ResultView so it can POST /api/scan again for a standalone reward
  // redeem without re-scanning.
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  // How many stamps to apply in a single scan (stamp mode only). The /api/scan
  // route accepts a `delta` (1–50), so one scan can add several stamps at once.
  const [quantity, setQuantity] = useState(1);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const modeRef = useRef<Mode>(mode);
  const quantityRef = useRef(quantity);

  // Keep the latest mode/quantity readable inside the scan callback without
  // re-creating it.
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  async function stop() {
    await stopScanner(scannerRef.current);
    setScanning(false);
    busyRef.current = false;
  }

  async function submit(barcode: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setLastBarcode(barcode);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          action: modeRef.current,
          delta: modeRef.current === "stamp" ? quantityRef.current : 1,
        }),
      });
      const data = (await res.json()) as ScanResult;
      setResult({ ...data, ok: res.ok && data.ok !== false });
    } catch {
      setResult({ ok: false, error: "network" });
    } finally {
      await stop();
      // Reset to a single stamp so the count can't accidentally carry over to
      // the next customer.
      setQuantity(1);
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
      void stopScanner(scannerRef.current);
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

      {/* Stamp quantity — one scan can add several stamps at once */}
      {mode === "stamp" && (
        <div className="border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <span className="text-sm font-medium">
            {dict.dashboard.scan.quantityLabel}
          </span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label={dict.dashboard.scan.quantityDecrease}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-6 text-center text-lg font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              disabled={quantity >= 50}
              aria-label={dict.dashboard.scan.quantityIncrease}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      )}

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

          {result && (
            <ResultView
              result={result}
              dict={dict}
              onNext={start}
              barcode={lastBarcode}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultView({
  result,
  dict,
  onNext,
  barcode,
}: {
  result: ScanResult;
  dict: Dictionary;
  onNext: () => void;
  barcode: string | null;
}) {
  const success = result.ok;
  const rewardReady = result.status === "completed";

  // Seeded once from the scan result — ResultView unmounts (result briefly
  // goes null while the camera restarts) and remounts fresh for every new
  // scan, so this initializer always reflects the current result, and
  // redeeming a reward below can remove it from this local list without
  // needing a re-scan.
  const [rewards, setRewards] = useState<StandaloneRewardItem[]>(() =>
    (result.standaloneRewards ?? []).filter((r) => r.isAvailableNow),
  );
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [rewardErrors, setRewardErrors] = useState<Record<string, string>>({});

  async function redeemStandaloneReward(rewardId: string) {
    if (!barcode || redeemingId) return;
    setRedeemingId(rewardId);
    setRewardErrors((prev) => {
      if (!(rewardId in prev)) return prev;
      const next = { ...prev };
      delete next[rewardId];
      return next;
    });
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          action: "redeem_standalone_reward",
          grant_id: rewardId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && data.ok !== false) {
        setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      } else {
        setRewardErrors((prev) => ({
          ...prev,
          [rewardId]:
            data.error === "not_redeemable"
              ? dict.dashboard.scan.errors.rewardNotRedeemable
              : dict.dashboard.scan.errors.generic,
        }));
      }
    } catch {
      setRewardErrors((prev) => ({
        ...prev,
        [rewardId]: dict.dashboard.scan.errors.generic,
      }));
    } finally {
      setRedeemingId(null);
    }
  }

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
          {rewards.length > 0 && (
            <div className="flex w-full flex-col gap-2 text-left">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {dict.card.availableRewards}
              </p>
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="border-border flex flex-col gap-1 rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Gift className="text-accent-foreground size-4 shrink-0" />
                      {reward.title}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="capitalize"
                      disabled={redeemingId === reward.id}
                      onClick={() => redeemStandaloneReward(reward.id)}
                    >
                      {dict.dashboard.scan.modeRedeem}
                    </Button>
                  </div>
                  {rewardErrors[reward.id] && (
                    <p className="text-destructive text-xs">
                      {rewardErrors[reward.id]}
                    </p>
                  )}
                </div>
              ))}
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
    case "program_disabled":
      return dict.dashboard.scan.errors.programDisabled;
    case "unauthorized":
      return dict.dashboard.scan.errors.unauthorized;
    case "network":
      return dict.dashboard.scan.errors.network;
    default:
      // Instrumentation: `rpc_failed` (and any other unmapped code) carries the
      // raw DB/RPC reason in `detail` — append it (untranslated) so a failing
      // scan is diagnosable on-device instead of hidden behind the generic text.
      return result.detail
        ? `${dict.dashboard.scan.errors.generic} (${result.detail})`
        : dict.dashboard.scan.errors.generic;
  }
}
