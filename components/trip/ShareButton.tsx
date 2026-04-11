"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  joinCode: string;
  className?: string;
}

export default function ShareButton({ joinCode, className }: ShareButtonProps) {
  function handleCopy() {
    const url = `${window.location.origin}/join/${joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied");
    });
  }

  return (
    <Button
      variant="outline"
      className={cn("gap-2 min-h-[44px]", className)}
      onClick={handleCopy}
    >
      <Copy className="h-4 w-4" />
      Copy invite link
    </Button>
  );
}
