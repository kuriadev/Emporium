"use client";

import { Printer, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { cancelOrderAction, requestReturnAction } from "@/server/actions/shop";

type Mode = "cancel" | "return" | null;

const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Changed my mind"];
const RETURN_REASONS = ["The size doesn't fit. I'd like to exchange for a size M.", "The item arrived damaged. The box was crushed in transit.", "It's not what I expected from the photos."];

export function OrderActions({ orderId, canCancel, canReturn }: { orderId: string; canCancel: boolean; canReturn: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const open = (m: Mode) => {
    setMode(m);
    setReason(m === "cancel" ? CANCEL_REASONS[0]! : RETURN_REASONS[0]!);
    setError(undefined);
  };

  const submit = async () => {
    setBusy(true);
    const res = mode === "cancel" ? await cancelOrderAction({ orderId, reason }) : await requestReturnAction({ orderId, reason });
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.reason ?? res.error);
      setShake((n) => n + 1);
      return;
    }
    toast.success(res.message ?? "Done");
    setMode(null);
    router.refresh();
  };

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden /> Print invoice
      </Button>
      {canCancel && (
        <Button variant="danger" size="sm" onClick={() => open("cancel")}>
          <XCircle className="size-4" aria-hidden /> Cancel order
        </Button>
      )}
      {canReturn && (
        <Button variant="outline" size="sm" onClick={() => open("return")}>
          <RotateCcw className="size-4" aria-hidden /> Request a return
        </Button>
      )}
      <Modal open={mode !== null} onOpenChange={(o) => !o && setMode(null)} title={mode === "cancel" ? "Cancel this order?" : "Request a return"} description={mode === "cancel" ? "Items go back on the shelf and you're refunded to the original payment method." : "We'll email a prepaid return label within 24 hours."} className="w-[min(calc(100vw-2rem),32rem)]">
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(mode === "cancel" ? CANCEL_REASONS : RETURN_REASONS).map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={`min-h-[2.25rem] pointer-coarse:min-h-tap rounded-pill border px-3 text-left text-xs transition ${reason === r ? "border-accent text-fg" : "border-line text-muted hover:text-fg"}`}>
                {r.length > 40 ? `${r.slice(0, 38)}…` : r}
              </button>
            ))}
          </div>
          <Field as="textarea" label="Reason" value={reason} maxLength={mode === "cancel" ? 200 : 500} showCounter onChange={(e) => setReason(e.target.value)} error={error} shakeKey={shake} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Keep order
            </Button>
            <Button variant={mode === "cancel" ? "danger" : "primary"} loading={busy} onClick={() => void submit()}>
              {mode === "cancel" ? "Cancel order" : "Submit return"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
