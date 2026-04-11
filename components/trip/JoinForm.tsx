"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { joinTrip } from "@/app/actions/join-trip";

const EMOJIS = [
  "😊", "😎", "🤩", "🥳", "😄", "🤠",
  "🐻", "🦁", "🐧", "🦊", "🐨", "🐙",
  "✈️", "🌍", "🗺️", "🧳", "🏝️", "🎒",
  "🌟", "🎉", "🍕", "🎸", "🏄", "🧗",
];

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Max 30 characters"),
  emoji: z.string().min(1, "Pick an emoji"),
});

type FormValues = z.infer<typeof formSchema>;

export default function JoinForm({ tripId }: { tripId: string }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", emoji: "" },
  });

  async function onSubmit(values: FormValues) {
    const result = await joinTrip({ tripId, ...values });
    if (result && "error" in result) {
      toast.error(result.error);
    }
    // On success the server action redirects — no further client handling
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          placeholder="e.g. Alex"
          {...register("name")}
          className={cn(errors.name && "border-destructive")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Your emoji</Label>
        <Controller
          name="emoji"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => field.onChange(emoji)}
                  className={cn(
                    "h-11 w-full flex items-center justify-center rounded-lg text-xl border transition-colors",
                    field.value === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-secondary"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        />
        {errors.emoji && (
          <p className="text-xs text-destructive">{errors.emoji.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full min-h-[44px]" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining…
          </>
        ) : (
          "Join trip"
        )}
      </Button>
    </form>
  );
}
