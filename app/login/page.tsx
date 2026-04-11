"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink } from "@/app/actions/send-magic-link";

function LoginForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "1";

  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await sendMagicLink({ email });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      {hasError && (
        <p className="text-sm text-destructive text-center mb-4">
          That link expired or is invalid. Try again below.
        </p>
      )}

      {sent ? (
        <div className="text-center space-y-3 py-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50">
            <Mail className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="font-display text-3xl text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a magic link to <strong>{email}</strong>.
            Click it to sign in — it expires in 1 hour.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send magic link"
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Just joining a trip?{" "}
            <a href="/" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Use an invite link instead
            </a>
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-14 pb-10 text-center">
        <a href="/" className="font-display text-2xl text-white/60 hover:text-white transition-colors">
          TripSync
        </a>
        <h1 className="font-display text-5xl text-[#FAF8F5] leading-tight mt-4">
          Organizer login
        </h1>
        <p className="text-white/45 text-sm mt-2">
          We&apos;ll send a magic link — no password needed
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
