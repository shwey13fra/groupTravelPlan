"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Archive,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview",  path: "",           icon: LayoutDashboard },
  { label: "Itinerary", path: "/itinerary", icon: CalendarDays    },
  { label: "Tasks",     path: "/tasks",     icon: CheckSquare     },
  { label: "Vault",     path: "/vault",     icon: Archive         },
  { label: "Expenses",  path: "/expenses",  icon: Receipt         },
];

export default function TripTabNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  function isActive(path: string) {
    const href = `/trip/${tripId}${path}`;
    return path === ""
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* ── Desktop: sticky top nav ──────────────────────────────────────── */}
      <nav className="glass-nav hidden sm:flex overflow-x-auto scrollbar-hide">
        <div className="flex min-w-max px-6 mx-auto w-full max-w-2xl">
          {TABS.map((tab) => {
            const href    = `/trip/${tripId}${tab.path}`;
            const active  = isActive(tab.path);
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-[var(--vibe-accent,#1C2B4A)] text-[var(--vibe-accent,#1C2B4A)]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-[#E8E4DE]"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile: fixed bottom tab bar ─────────────────────────────────── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-[#E8E4DE]/70 bg-[#FAF8F5]/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          const href   = `/trip/${tripId}${tab.path}`;
          const active = isActive(tab.path);
          const Icon   = tab.icon;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                active
                  ? "text-[var(--vibe-accent,#1C2B4A)]"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <Icon
                className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
