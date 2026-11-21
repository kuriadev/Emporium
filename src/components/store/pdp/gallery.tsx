"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Modal } from "@/components/ui/overlay";
import type { ImageRef } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Multi-angle gallery: hover-to-zoom lens on fine pointers, swipe and arrow keys between angles,
 * thumbnails that swap on hover, and a full-screen viewer for touch devices.
 */
export function Gallery({ images, name }: { images: ImageRef[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const reduce = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const count = images.length;
  const current = images[index] ?? images[0];

  const go = useCallback(
    (next: number) => {
      setDir(next > index ? 1 : -1);
      setIndex((next + count) % count);
    },
    [index, count],
  );

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !frame.current) return;
    const r = frame.current.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
  };

  if (!current) return <div className="aspect-square rounded-xl bg-surface" />;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row" role="region" aria-roledescription="carousel" aria-label={`${name} images`}>
      {count > 1 && (
        <ul className="flex gap-2 md:flex-col" aria-label="Choose image">
          {images.map((im, i) => (
            <li key={im.src}>
              <button
                type="button"
                onClick={() => go(i)}
                onMouseEnter={() => go(i)}
                aria-label={`Show image ${i + 1} of ${count}: ${im.alt}`}
                aria-current={i === index}
                className={cn("relative block size-16 overflow-hidden rounded-sm bg-white ring-offset-2 ring-offset-bg transition md:size-20", i === index ? "ring-2 ring-fg" : "opacity-60 hover:opacity-100")}
              >
                <Image src={im.src} alt="" fill sizes="5rem" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          ref={frame}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerMove={onMove}
          onPointerLeave={() => setZoom(null)}
          className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-white outline-offset-4"
          aria-label={`Image ${index + 1} of ${count}. Use left and right arrow keys to change.`}
        >
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={current.src}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: `${dir * 8}%` }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: `${dir * -8}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              drag={count > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(index + 1);
                else if (info.offset.x > 60) go(index - 1);
              }}
              className="absolute inset-0"
            >
              <Image
                src={current.src}
                alt={current.alt}
                fill
                priority={index === 0}
                sizes="(min-width: 80rem) 40rem, (min-width: 48rem) 50vw, 100vw"
                className="object-cover transition-transform duration-200 ease-out"
                style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          {count > 1 && (
            <>
              <NavBtn side="left" onClick={() => go(index - 1)} />
              <NavBtn side="right" onClick={() => go(index + 1)} />
            </>
          )}
          <button
            type="button"
            onClick={() => setFull(true)}
            className="absolute bottom-3 right-3 grid size-tap place-items-center rounded-full bg-black/70 text-fg backdrop-blur transition hover:bg-black"
            aria-label="Open full-screen viewer"
          >
            <Expand className="size-5" />
          </button>
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-pill bg-black/60 px-3 py-1 text-xs text-fg md:hidden" aria-hidden>
            {index + 1} / {count}
          </p>
        </div>
      </div>

      <Modal open={full} onOpenChange={setFull} title={`${name}: image ${index + 1} of ${count}`} hideTitle className="w-[min(calc(100vw-1rem),72rem)] p-3 sm:p-4">
        <div className="relative aspect-square max-h-[80dvh] w-full overflow-hidden rounded-lg bg-white" tabIndex={0} onKeyDown={onKey}>
          <Image src={current.src} alt={current.alt} fill sizes="(min-width: 72rem) 72rem, 100vw" className="object-contain" />
          {count > 1 && (
            <>
              <NavBtn side="left" onClick={() => go(index - 1)} always />
              <NavBtn side="right" onClick={() => go(index + 1)} always />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function NavBtn({ side, onClick, always }: { side: "left" | "right"; onClick: () => void; always?: boolean }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 grid size-tap -translate-y-1/2 place-items-center rounded-full bg-black/70 text-fg backdrop-blur transition hover:bg-black focus-visible:opacity-100",
        side === "left" ? "left-3" : "right-3",
        !always && "md:opacity-0 md:group-hover:opacity-100",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
