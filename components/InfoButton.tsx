"use client";

import { useState, useEffect, useRef } from "react";

const FEATURES = [
  { icon: "✨", text: "AI destination picks & day-by-day itinerary" },
  { icon: "🗳️", text: "Group votes, commitments & task tracker" },
  { icon: "💸", text: "Shared vault, expenses & fair-split calculator" },
];

export default function InfoButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Feature popover */}
      {open && (
        <div className="animate-fade-up w-64 rounded-2xl border border-white/[0.1] bg-white/[0.07] p-4 backdrop-blur-xl shadow-2xl shadow-black/40">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            What&apos;s inside
          </p>
          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/65">
                <span className="mt-px shrink-0 text-base leading-none">{icon}</span>
                <span className="leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* i button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="What's inside TripSync"
        className={`
          flex h-9 w-9 items-center justify-center rounded-full border
          text-sm font-semibold transition-all duration-200
          ${open
            ? "border-white/30 bg-white/15 text-white shadow-lg shadow-black/30"
            : "border-white/[0.12] bg-white/[0.06] text-white/45 hover:bg-white/[0.12] hover:text-white/70 hover:border-white/20"
          }
          backdrop-blur-sm
        `}
      >
        i
      </button>
    </div>
  );
}
