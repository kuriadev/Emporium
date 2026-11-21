"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { AlertCircle, Check } from "lucide-react";
import { forwardRef, useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Base = {
  label: string;
  error?: string;
  valid?: boolean;
  hint?: ReactNode;
  maxLength?: number;
  showCounter?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  shakeKey?: number;
  containerClassName?: string;
};

type InputProps = Base & Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> & { as?: "input" };
type TextareaProps = Base & React.TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };
type SelectProps = Base & React.SelectHTMLAttributes<HTMLSelectElement> & { as: "select"; children: ReactNode };
export type FieldProps = InputProps | TextareaProps | SelectProps;

const shell =
  "relative flex w-full items-center gap-2 rounded-md border bg-surface/70 px-4 transition-[border-color,box-shadow,background-color] duration-200";

/**
 * Tactile form field: spring focus lift + oversized glow ring, label pop while typing valid input,
 * shake + red highlight when invalid, checkmark pop when valid. Motion collapses to instant state
 * changes under prefers-reduced-motion. Never intercepts keystrokes (onChange is passed straight through).
 */
export const Field = forwardRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement, FieldProps>(function Field(props, ref) {
  const { label, error, valid, hint, maxLength, showCounter, prefix, suffix, shakeKey, containerClassName, className, id, ...rest } = props;
  const autoId = useId();
  const fieldId = id ?? `f-${autoId}`;
  const msgId = `${fieldId}-msg`;
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const labelControls = useAnimationControls();
  const [focused, setFocused] = useState(false);
  const [length, setLength] = useState(() => String(rest.value ?? rest.defaultValue ?? "").length);
  const prevError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (error && !reduce && (error !== prevError.current || shakeKey)) {
      void controls.start({ x: [0, -10, 9, -7, 5, -2, 0], transition: { duration: 0.32, ease: "easeOut" } });
    }
    prevError.current = error;
  }, [error, shakeKey, controls, reduce]);

  const onChange = (e: ChangeEvent<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>) => {
    setLength(e.target.value.length);
    if (!reduce && !error) void labelControls.start({ scale: [1, 1.06, 1], transition: { duration: 0.18 } });
    (rest.onChange as ((e: ChangeEvent<unknown>) => void) | undefined)?.(e);
  };

  const state = error ? "error" : valid ? "valid" : "idle";
  const common = {
    id: fieldId,
    ref,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": msgId,
    maxLength,
    onFocus: (e: React.FocusEvent<never>) => {
      setFocused(true);
      (rest.onFocus as ((e: React.FocusEvent<never>) => void) | undefined)?.(e);
    },
    onBlur: (e: React.FocusEvent<never>) => {
      setFocused(false);
      (rest.onBlur as ((e: React.FocusEvent<never>) => void) | undefined)?.(e);
    },
    onChange,
    className: cn(
      "peer w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-subtle/80",
      props.as === "textarea" ? "min-h-[7rem] resize-y py-3 leading-relaxed" : "min-h-[3rem]",
      props.as === "select" && "cursor-pointer appearance-none",
      className,
    ),
  };

  let control: ReactNode;
  if (props.as === "textarea") {
    const { as: _as, ...ta } = rest as Omit<TextareaProps, keyof Base>;
    control = <textarea {...ta} {...common} />;
  } else if (props.as === "select") {
    const { as: _as, children, ...sel } = rest as Omit<SelectProps, keyof Base>;
    control = (
      <select {...sel} {...common}>
        {children}
      </select>
    );
  } else {
    const { as: _as, ...inp } = rest as Omit<InputProps, keyof Base>;
    control = <input {...inp} {...common} />;
  }

  return (
    <motion.div animate={controls} className={cn("flex w-full flex-col gap-1.5", containerClassName)}>
      <div className="flex items-baseline justify-between gap-3">
        <motion.label animate={labelControls} htmlFor={fieldId} className={cn("origin-left text-sm tracking-wide transition-colors", error ? "text-danger" : focused ? "text-fg" : "text-muted")}>
          {label}
          {rest.required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
        </motion.label>
        {showCounter && maxLength ? (
          <motion.span
            key={length}
            initial={reduce ? false : { scale: 1.25, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 700, damping: 20 }}
            className={cn("text-2xs tabular-nums", length > maxLength * 0.9 ? "text-warning" : "text-subtle")}
            aria-hidden
          >
            {length}/{maxLength}
          </motion.span>
        ) : null}
      </div>
      <motion.div
        animate={focused && !reduce ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 26 }}
        className={cn(
          shell,
          state === "error" && "border-danger bg-danger/10 shadow-[0_0_0_0.25rem_oklch(0.7_0.2_25/0.25)]",
          state === "valid" && !focused && "border-success/70",
          state !== "error" && focused && "border-accent shadow-[0_0_0_0.3125rem_oklch(0.78_0.11_315/0.28),0_0.75rem_2rem_-0.5rem_oklch(0.78_0.11_315/0.35)]",
          state === "idle" && !focused && "border-line hover:border-line-strong",
        )}
      >
        {prefix && <span className="shrink-0 text-muted">{prefix}</span>}
        {control}
        {suffix}
        <AnimatePresence initial={false}>
          {state === "valid" && (
            <motion.span
              key="ok"
              initial={reduce ? false : { scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 800, damping: 14 }}
              className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-bg"
              aria-hidden
            >
              <Check className="size-4" strokeWidth={3} />
            </motion.span>
          )}
          {state === "error" && (
            <motion.span key="err" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="shrink-0 text-danger" aria-hidden>
              <AlertCircle className="size-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <div id={msgId} aria-live="polite" className="min-h-[1.25rem] text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p key={error} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="font-medium text-danger">
              {error}
            </motion.p>
          ) : hint ? (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-subtle">
              {hint}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
