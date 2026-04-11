"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateCommitment } from "@/app/actions/update-commitment";

interface Props {
  tripId:         string;
  memberId:       string;
  currentStatus:  "in" | "out" | "pending";
  confirmedCount: number;
  totalCount:     number;
}

export default function CommitmentWidget({
  tripId,
  memberId,
  currentStatus,
  confirmedCount,
  totalCount,
}: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");
  const [loading, setLoading] = useState(false);

  async function handleOut() {
    setLoading(true);
    const result = await updateCommitment({ memberId, tripId, status: "out" });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    router.refresh();
  }

  async function handleIn() {
    setLoading(true);
    const result = await updateCommitment({
      memberId,
      tripId,
      status: "in",
      ...(from ? { availableFrom: from } : {}),
      ...(to   ? { availableTo:   to   } : {}),
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    setOpen(false);
    router.refresh();
  }

  const countLine = (
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{confirmedCount}</span>
      {" of "}
      <span className="font-semibold text-foreground">{totalCount}</span>
      {" confirmed"}
    </p>
  );

  // Already responded
  if (currentStatus !== "pending") {
    return (
      <div className="flex items-center justify-between py-3 border-b border-[#E8E4DE]">
        {countLine}
        <span
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium",
            currentStatus === "in"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          )}
        >
          {currentStatus === "in" ? "You're in ✓" : "You're out"}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="py-3 border-b border-[#E8E4DE] space-y-3">
        {countLine}
        <div className="flex gap-2">
          <Button
            onClick={() => setOpen(true)}
            disabled={loading}
            className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white border-0"
          >
            I&apos;m in
          </Button>
          <Button
            variant="outline"
            onClick={handleOut}
            disabled={loading}
            className="flex-1 min-h-[44px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "I'm out"}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">
              When are you free?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="avail-from">Available from</Label>
              <Input
                id="avail-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avail-to">Available to</Label>
              <Input
                id="avail-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dates are optional — you can skip them.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleIn}
              disabled={loading}
              className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm — I'm in"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
