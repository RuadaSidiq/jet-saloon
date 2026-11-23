"use client";
import { useState } from "react";
import { reviewAction } from "@/app/actions/booking";
import { ActionForm, Submit } from "@/components/ui/form";
import { Textarea } from "@/components/ui";

export function ReviewForm({ bookingRef }: { bookingRef: string }) {
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={reviewAction}>
      <input type="hidden" name="ref" value={bookingRef} /><input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setRating(i)} className={`text-2xl ${i <= rating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}
      </div>
      <Textarea name="comment" rows={3} className="mt-3" placeholder="What did you like? Would you recommend them?" maxLength={2000} />
      <div className="mt-3"><Submit size="sm">Post review</Submit></div>
    </ActionForm>
  );
}
