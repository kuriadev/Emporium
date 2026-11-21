"use client";

import { Ban, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { updateCustomerAction } from "@/server/actions/admin";

const NOTES_MAX = 2000;
const NOTE_PRESETS = ["VIP: pack first, add a thank-you card", "Prefers GCash", "Call before delivery", "Fragile: double box", "Asked about bulk pricing"];

/** Staff-only CRM notes. The server re-sanitises and enforces the `customers:notes` permission. */
export function CustomerNotes({ userId, initial, canEdit }: { userId: string; initial: string; canEdit: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dirty = notes.trim() !== saved.trim();

  if (!canEdit) {
    return initial ? <p className="whitespace-pre-line text-sm text-muted">{initial}</p> : <p className="text-sm text-subtle">No notes yet. Your role can read notes but not change them.</p>;
  }

  const append = (line: string) => setNotes((n) => (n.includes(line) ? n : `${n.trim() ? `${n.trim()}\n` : ""}${line}`).slice(0, NOTES_MAX));

  const save = async () => {
    setBusy(true);
    setAttempt((a) => a + 1);
    const res = await updateCustomerAction({ userId, notes });
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.notes ?? res.error);
      toast.error(res.error);
      return;
    }
    setError(undefined);
    setSaved(notes);
    toast.success(res.message ?? "Notes saved", { description: "Visible to staff only and recorded in the audit log." });
    router.refresh();
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field
        as="textarea"
        label="Staff notes"
        rows={5}
        value={notes}
        maxLength={NOTES_MAX}
        showCounter
        onChange={(e) => setNotes(e.target.value)}
        error={error}
        shakeKey={attempt}
        hint="Staff only. Never paste card numbers, passwords or ID numbers."
      />
      <div className="mb-4 mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick notes">
        {NOTE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => append(p)}
            className="min-h-[2.25rem] rounded-pill border border-dashed border-line-strong px-3 text-xs text-muted transition hover:border-fg hover:text-fg active:scale-95 pointer-coarse:min-h-tap"
          >
            + {p}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setNotes(saved);
              setError(undefined);
            }}
          >
            Discard changes
          </Button>
        )}
        <Button type="submit" size="sm" loading={busy} disabled={!dirty}>
          Save notes
        </Button>
      </div>
    </form>
  );
}

/** Suspend / reactivate. Suspension bumps the session version server-side, so every device signs out. */
export function CustomerStatusControl({ userId, name, status }: { userId: string; name: string; status: "active" | "suspended" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstName = name.split(" ")[0] || name;

  const apply = async (next: "active" | "suspended") => {
    setBusy(true);
    const res = await updateCustomerAction({ userId, status: next });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    toast.success(res.message ?? "Customer updated", { description: "Recorded in the audit log." });
    router.refresh();
  };

  if (status === "suspended") {
    return (
      <div>
        <p className="text-sm text-muted">{firstName} can&apos;t sign in until you reactivate the account. Their order history is untouched.</p>
        <Button className="mt-3" size="sm" variant="outline" loading={busy} onClick={() => void apply("active")}>
          <ShieldCheck className="size-4" aria-hidden /> Reactivate account
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">Use this for fraud or abuse. {firstName} is signed out on every device and can&apos;t sign in again until reactivated.</p>
      <Button className="mt-3" size="sm" variant="danger" onClick={() => setOpen(true)}>
        <Ban className="size-4" aria-hidden /> Suspend account
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={`Suspend ${name}?`} description="You can undo this at any time from this page." className="max-w-[30rem]">
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Signs them out on every device right away.</li>
          <li>Blocks sign-in, so saved bags, wishlists and addresses can&apos;t be used.</li>
          <li>Orders already placed keep moving through fulfilment.</li>
        </ul>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep active
          </Button>
          <Button variant="danger" size="sm" loading={busy} onClick={() => void apply("suspended")}>
            Suspend account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
