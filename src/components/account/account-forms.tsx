"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { changePasswordSchema, deleteAccountSchema } from "@/lib/validations/auth";
import { savedAddressSchema } from "@/lib/validations/commerce";
import { changePasswordAction, deleteAccountAction } from "@/server/actions/auth";
import { deleteAddressAction, saveAddressAction } from "@/server/actions/shop";

export interface AddressView {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
}

type AddrIn = z.input<typeof savedAddressSchema>;
type AddrOut = z.output<typeof savedAddressSchema>;

const ADDRESS_PRESETS: { label: string; value: Partial<AddrIn> }[] = [
  { label: "Office · BGC", value: { label: "Office", line1: "28th Floor, High Street South Corporate Plaza, 26th Street", line2: "Bonifacio Global City", city: "Taguig", province: "Metro Manila", postalCode: "1634" } },
  { label: "Family · Cebu", value: { label: "Family", line1: "45 Gorordo Avenue", line2: "Lahug", city: "Cebu City", province: "Cebu", postalCode: "6000" } },
];

export function AddressManager({ addresses, name, phone }: { addresses: AddressView[]; name: string; phone: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const form = useForm<AddrIn, unknown, AddrOut>({
    resolver: zodResolver(savedAddressSchema),
    mode: "onTouched",
    defaultValues: { label: "Office", fullName: name, phone: phone || "+63 917 555 0142", ...ADDRESS_PRESETS[0]!.value, country: "PH", isDefault: addresses.length === 0 },
  });
  const { errors, isSubmitting, submitCount, dirtyFields } = form.formState;
  const v = (k: keyof AddrIn) => !!dirtyFields[k] && !errors[k];

  return (
    <div className="space-y-4">
      <ul className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {addresses.map((a) => (
            <motion.li key={a.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-3 rounded-lg border border-line p-4 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  {a.label} {a.isDefault && <Badge tone="accent">Default</Badge>}
                </p>
                <p className="mt-1 text-muted">
                  {a.fullName} · {a.phone}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.province} {a.postalCode}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${a.label} address`}
                loading={removing === a.id}
                onClick={async () => {
                  setRemoving(a.id);
                  const res = await deleteAddressAction(a.id);
                  setRemoving(null);
                  if (res.ok) {
                    toast.success(res.message ?? "Address removed");
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {addresses.length === 0 && !adding && <p className="text-sm text-muted">No saved addresses yet. Addresses you use at checkout are saved here automatically.</p>}

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            noValidate
            className="space-y-4 overflow-hidden rounded-lg border border-line-strong bg-surface/60 p-4 sm:p-5"
            onSubmit={form.handleSubmit(async (data) => {
              const res = await saveAddressAction(data);
              if (!res.ok) {
                toast.error(res.error);
                for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof AddrIn, { message: msg });
                return;
              }
              toast.success(res.message ?? "Address saved");
              setAdding(false);
              form.reset();
              router.refresh();
            })}
          >
            <div className="flex flex-wrap gap-2">
              {ADDRESS_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => Object.entries(p.value).forEach(([k, val]) => form.setValue(k as keyof AddrIn, val as never, { shouldDirty: true, shouldValidate: true }))} className="min-h-[2.25rem] rounded-pill border border-dashed border-line-strong px-3 text-xs text-muted hover:border-fg hover:text-fg active:scale-95">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Label" {...form.register("label")} error={errors.label?.message} valid={v("label")} shakeKey={submitCount} />
              <Field label="Full name" autoComplete="name" {...form.register("fullName")} error={errors.fullName?.message} valid={v("fullName")} shakeKey={submitCount} />
              <Field label="Mobile number" type="tel" autoComplete="tel" {...form.register("phone")} error={errors.phone?.message} valid={v("phone")} shakeKey={submitCount} />
            </div>
            <Field label="Street address" autoComplete="address-line1" {...form.register("line1")} error={errors.line1?.message} valid={v("line1")} shakeKey={submitCount} />
            <Field label="Barangay, building or landmark (optional)" autoComplete="address-line2" {...form.register("line2")} error={errors.line2?.message} shakeKey={submitCount} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City" autoComplete="address-level2" {...form.register("city")} error={errors.city?.message} valid={v("city")} shakeKey={submitCount} />
              <Field label="Province" autoComplete="address-level1" {...form.register("province")} error={errors.province?.message} valid={v("province")} shakeKey={submitCount} />
              <Field label="Postal code" inputMode="numeric" maxLength={4} autoComplete="postal-code" {...form.register("postalCode")} error={errors.postalCode?.message} valid={v("postalCode")} shakeKey={submitCount} />
            </div>
            <label className="flex min-h-tap cursor-pointer items-center gap-3 text-sm text-muted">
              <input type="checkbox" {...form.register("isDefault")} className="size-4 accent-[var(--color-accent)]" />
              <Star className="size-4" aria-hidden /> Make this my default address
            </label>
            <div className="flex gap-2">
              <Button type="submit" loading={isSubmitting}>
                Save address
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </motion.form>
        ) : (
          <Button key="add" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add an address
          </Button>
        )}
      </AnimatePresence>
    </div>
  );
}

type PwIn = z.input<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const form = useForm<PwIn>({ resolver: zodResolver(changePasswordSchema), mode: "onTouched", defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const { errors, isSubmitting, submitCount } = form.formState;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (data) => {
        const res = await changePasswordAction(data);
        if (!res.ok) {
          for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof PwIn, { message: msg });
          if (!res.fieldErrors) toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Password updated");
        form.reset();
      })}
    >
      <Field label="Current password" type="password" autoComplete="current-password" {...form.register("currentPassword")} error={errors.currentPassword?.message} shakeKey={submitCount} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" type="password" autoComplete="new-password" {...form.register("newPassword")} error={errors.newPassword?.message} shakeKey={submitCount} hint="10+ characters with upper and lower case, a number and a symbol." />
        <Field label="Confirm new password" type="password" autoComplete="new-password" {...form.register("confirmPassword")} error={errors.confirmPassword?.message} shakeKey={submitCount} />
      </div>
      <Button type="submit" variant="outline" loading={isSubmitting}>
        <KeyRound className="size-4" aria-hidden /> Update password
      </Button>
    </form>
  );
}

type DelIn = z.input<typeof deleteAccountSchema>;

export function DeleteAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<DelIn>({ resolver: zodResolver(deleteAccountSchema), mode: "onTouched", defaultValues: { password: "", confirm: "" as "DELETE" } });
  const { errors, isSubmitting, submitCount } = form.formState;
  if (!open)
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete my account
      </Button>
    );
  return (
    <form
      noValidate
      className="space-y-4 rounded-lg border border-danger/50 bg-danger/5 p-4"
      onSubmit={form.handleSubmit(async (data) => {
        const res = await deleteAccountAction(data);
        if (!res.ok) {
          for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof DelIn, { message: msg });
          if (!res.fieldErrors) toast.error(res.error);
          return;
        }
        toast.success(res.message ?? "Account deleted");
        router.replace("/");
        router.refresh();
      })}
    >
      <p className="text-sm text-danger">This permanently deletes your profile, addresses, wishlist and bag. Past orders are kept for tax records but stripped of your name, email and address. This can&apos;t be undone.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" type="password" autoComplete="current-password" {...form.register("password")} error={errors.password?.message} shakeKey={submitCount} />
        <Field label='Type "DELETE" to confirm' autoComplete="off" {...form.register("confirm")} error={errors.confirm?.message} shakeKey={submitCount} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={isSubmitting}>
          Permanently delete
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
