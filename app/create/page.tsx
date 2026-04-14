"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createTrip } from "@/app/actions/create-trip";

// ── Constants ─────────────────────────────────────────────────────────────

const EMOJIS = [
  "😊", "😎", "🤩", "🥳", "😄", "🤠",
  "🐻", "🦁", "🐧", "🦊", "🐨", "🐙",
  "✈️", "🌍", "🗺️", "🧳", "🏝️", "🎒",
  "🌟", "🎉", "🍕", "🎸", "🏄", "🧗",
] as const;

const VIBES = [
  { value: "beach",     emoji: "🏖️", label: "Beach",     accent: "#06b6d4" },
  { value: "mountains", emoji: "⛰️", label: "Mountains", accent: "#6366f1" },
  { value: "city",      emoji: "🏙️", label: "City",      accent: "#a855f7" },
  { value: "heritage",  emoji: "🏛️", label: "Heritage",  accent: "#d97706" },
  { value: "adventure", emoji: "🎒", label: "Adventure",  accent: "#f97316" },
] as const;

const GROUP_TYPES = [
  { value: "friends", label: "Friends 👯" },
  { value: "family",  label: "Family 👨‍👩‍👧" },
  { value: "mixed",   label: "Mixed 🤝" },
] as const;

const CURRENCIES = [
  { code: "USD", symbol: "$",  label: "USD" },
  { code: "EUR", symbol: "€",  label: "EUR" },
  { code: "GBP", symbol: "£",  label: "GBP" },
  { code: "INR", symbol: "₹",  label: "INR" },
  { code: "AED", symbol: "د.إ", label: "AED" },
  { code: "SGD", symbol: "S$", label: "SGD" },
  { code: "AUD", symbol: "A$", label: "AUD" },
  { code: "JPY", symbol: "¥",  label: "JPY" },
] as const;


// ── Schema (Zod v4) ───────────────────────────────────────────────────────

const formSchema = z
  .object({
    tripName:       z.string().min(2, "At least 2 characters").max(50, "Max 50 characters"),
    organizerName:  z.string().min(1, "Your name is required").max(30, "Max 30 characters"),
    organizerEmoji: z.string().min(1, "Pick an emoji for yourself"),
    // valueAsNumber=true in register means these arrive as number (NaN when empty)
    groupSize:      z.number().int().min(2, "Min 2 people").max(20, "Max 20 people"),
    currency:       z.string().min(1, "Pick a currency"),
    budgetMin:      z.number().int().min(1, "Enter a minimum budget"),
    budgetMax:      z.number().int().min(1, "Enter a maximum budget"),
    startDate:      z.string().min(1, "Start date required"),
    endDate:        z.string().min(1, "End date required"),
    vibe:      z.enum(["beach", "mountains", "city", "heritage", "adventure"] as const),
    groupType: z.enum(["friends", "family", "mixed"] as const),
  })
  .refine((d) => d.budgetMax > d.budgetMin, {
    message: "Max must be greater than min",
    path: ["budgetMax"],
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

type FormData = z.infer<typeof formSchema>;

const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormData)[]> = {
  1: ["tripName", "organizerName", "organizerEmoji"],
  2: ["groupSize", "currency", "budgetMin", "budgetMax", "startDate", "endDate"],
  3: ["vibe", "groupType"],
};

const STEP_TITLES = {
  1: { heading: "Plan a trip",  sub: "Start with the basics" },
  2: { heading: "The details",  sub: "Size, budget, and duration" },
  3: { heading: "Set the vibe", sub: "What kind of trip is this?" },
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tripName: "",
      organizerName: "",
      currency: "USD",
    },
    mode: "onBlur",
  });

  const startDateValue = watch("startDate");

  // Pre-fill end date with start date when start is chosen and end is still empty
  useEffect(() => {
    if (startDateValue && !getValues("endDate")) {
      setValue("endDate", startDateValue, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDateValue]);

  async function handleNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  function handleBack() {
    setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    try {
      const result = await createTrip(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/trip/${result.tripId}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const { heading, sub } = STEP_TITLES[step];

  return (
    <main className="min-h-screen bg-[#FAF8F5]">

      {/* Branded header */}
      <div
        className="px-6 py-4"
        style={{
          background: "linear-gradient(160deg, #0f172a 0%, #1e2d4a 100%)",
        }}
      >
        <a href="/" className="font-display text-2xl text-[#FAF8F5]/60 hover:text-[#FAF8F5] transition-colors">
          TripSync
        </a>
      </div>

      <div className="flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Step {step} of 3
            </span>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-500",
                  s < step
                    ? "bg-emerald-500"
                    : s === step
                    ? "bg-[#1C2B4A]"
                    : "bg-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="font-display text-4xl text-foreground leading-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground mt-1">{sub}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="tripName">Trip name</Label>
                <Input
                  id="tripName"
                  placeholder="e.g. Goa with the squad"
                  autoFocus
                  {...register("tripName")}
                />
                {errors.tripName && (
                  <p className="text-xs text-destructive">{errors.tripName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="organizerName">Your name</Label>
                <Input
                  id="organizerName"
                  placeholder="e.g. Priya"
                  {...register("organizerName")}
                />
                {errors.organizerName && (
                  <p className="text-xs text-destructive">{errors.organizerName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Your emoji</Label>
                <Controller
                  name="organizerEmoji"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={cn(
                            "h-11 w-full rounded-xl text-2xl flex items-center justify-center transition-all duration-150",
                            field.value === emoji
                              ? "bg-foreground/10 ring-2 ring-foreground scale-110"
                              : "bg-muted hover:bg-foreground/5 hover:scale-105"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.organizerEmoji && (
                  <p className="text-xs text-destructive">{errors.organizerEmoji.message}</p>
                )}
              </div>

              <Button type="button" onClick={handleNext} className="w-full min-h-[44px]">
                Continue
              </Button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="groupSize">Group size</Label>
                <Input
                  id="groupSize"
                  type="number"
                  placeholder="e.g. 6"
                  min={2}
                  max={20}
                  {...register("groupSize", { valueAsNumber: true })}
                />
                {errors.groupSize && (
                  <p className="text-xs text-destructive">{errors.groupSize.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Budget per person</Label>

                {/* Currency selector */}
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => {
                    const selected = CURRENCIES.find((c) => c.code === field.value);
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {CURRENCIES.map(({ code, label }) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => field.onChange(code)}
                              className={cn(
                                "px-3 py-1.5 text-xs rounded-lg border font-medium transition-all",
                                field.value === code
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border hover:border-foreground/40 text-foreground"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Min / Max inputs with currency prefix */}
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                              {selected?.symbol ?? "$"}
                            </span>
                            <Input
                              type="number"
                              placeholder="Min"
                              min={1}
                              className="pl-8"
                              {...register("budgetMin", { valueAsNumber: true })}
                            />
                          </div>
                          <span className="text-muted-foreground text-sm shrink-0">—</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                              {selected?.symbol ?? "$"}
                            </span>
                            <Input
                              type="number"
                              placeholder="Max"
                              min={1}
                              className="pl-8"
                              {...register("budgetMax", { valueAsNumber: true })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                {errors.currency && (
                  <p className="text-xs text-destructive">{errors.currency.message}</p>
                )}
                {errors.budgetMin && (
                  <p className="text-xs text-destructive">{errors.budgetMin.message}</p>
                )}
                {errors.budgetMax && (
                  <p className="text-xs text-destructive">{errors.budgetMax.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Trip dates</Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">Start</p>
                    <Input
                      id="startDate"
                      type="date"
                      {...register("startDate")}
                    />
                  </div>
                  <span className="text-muted-foreground text-sm shrink-0 pt-5">—</span>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">End</p>
                    <Input
                      id="endDate"
                      type="date"
                      min={startDateValue || undefined}
                      {...register("endDate")}
                    />
                  </div>
                </div>
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
              </div>

              <Button type="button" onClick={handleNext} className="w-full min-h-[44px]">
                Continue
              </Button>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-6">

              {/* Vibe */}
              <div className="space-y-2">
                <Label>Vibe</Label>
                <Controller
                  name="vibe"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-2">
                      {VIBES.map(({ value, emoji, label, accent }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className={cn(
                            "flex items-center gap-3 px-4 rounded-xl border-2 text-left transition-all min-h-[52px]",
                            field.value === value
                              ? "border-transparent"
                              : "border-border hover:border-foreground/20"
                          )}
                          style={
                            field.value === value
                              ? { borderColor: accent, background: `${accent}12` }
                              : undefined
                          }
                        >
                          <span className="text-2xl">{emoji}</span>
                          <span className="font-medium text-foreground">{label}</span>
                          {field.value === value && (
                            <span
                              className="ml-auto text-xs font-semibold"
                              style={{ color: accent }}
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.vibe && (
                  <p className="text-xs text-destructive">{errors.vibe.message}</p>
                )}
              </div>

              {/* Group type */}
              <div className="space-y-2">
                <Label>Who&apos;s coming?</Label>
                <Controller
                  name="groupType"
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {GROUP_TYPES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className={cn(
                            "flex-1 py-2.5 text-sm rounded-xl border-2 font-medium transition-all min-h-[44px]",
                            field.value === value
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground/40 text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {errors.groupType && (
                  <p className="text-xs text-destructive">{errors.groupType.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating your trip…
                  </span>
                ) : (
                  "Create trip →"
                )}
              </Button>
            </div>
          )}

        </form>
      </div>
      </div>
    </main>
  );
}
