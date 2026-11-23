"use client";
import { toggleFavouriteAction } from "@/app/actions/booking";
import { ActionForm, Submit } from "@/components/ui/form";

export function FavouriteButton({ providerId, saved }: { providerId: string; saved: boolean }) {
  return (
    <ActionForm action={toggleFavouriteAction}>
      <input type="hidden" name="providerId" value={providerId} />
      <Submit variant="secondary" size="lg" pendingText="…">{saved ? "♥ Saved" : "♡ Save"}</Submit>
    </ActionForm>
  );
}
