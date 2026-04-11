"use client";

import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  joinCode: string;
}

export default function ShareButton({ joinCode }: ShareButtonProps) {
  function handleCopy() {
    const url = `${window.location.origin}/join/${joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied");
    });
  }

  return (
    <Button
      variant="outline"
      className="gap-2 w-full sm:w-auto min-h-[44px]"
      onClick={handleCopy}
    >
      <Copy className="h-4 w-4" />
      Copy invite link
    </Button>
  );
}
