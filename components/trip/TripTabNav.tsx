"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview",  path: ""          },
  { label: "Itinerary", path: "/itinerary" },
  { label: "Tasks",     path: "/tasks"     },
  { label: "Vault",     path: "/vault"     },
  { label: "Expenses",  path: "/expenses"  },
];

export default function TripTabNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto scrollbar-hide border-b border-[#E8E4DE] bg-white">
      <div className="flex min-w-max px-4 sm:px-6 mx-auto w-full max-w-2xl">
        {TABS.map((tab) => {
          const href     = `/trip/${tripId}${tab.path}`;
          const isActive = tab.path === ""
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-[#1C2B4A] text-[#1C2B4A]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-[#E8E4DE]"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
