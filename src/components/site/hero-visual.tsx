import { CheckCircle2, Smartphone } from "lucide-react";

/**
 * Hero photo with two glass cards. Uses an admin-uploaded hero banner if present,
 * otherwise /brand/hero.jpg when it exists, otherwise a clean gradient panel.
 */
export function HeroVisual({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[500px] lg:aspect-auto lg:h-[560px]" aria-hidden>
      <div className="absolute inset-0 overflow-hidden rounded-[40px] bg-gradient-to-br from-[#5b9ae8] via-brand to-brand-dark shadow-[0_40px_90px_-40px_rgba(18,61,117,.8)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute -left-20 -top-24 size-80 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 size-96 rounded-full bg-[#9cc3f5]/40 blur-3xl" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-dark/40 to-transparent" />
      </div>

      <div className="glass absolute -left-4 top-16 rounded-3xl p-4 pr-6 sm:-left-10">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-ok-soft text-ok"><CheckCircle2 className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Booking confirmed</p><p className="text-xs text-muted">Sat, 10:00</p></div>
        </div>
      </div>

      <div className="glass absolute -right-3 bottom-14 rounded-3xl p-4 pr-6 sm:-right-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#fff4d6] text-[#b7791f]"><Smartphone className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Paid with MoMo</p><p className="text-xs text-muted">Secure checkout</p></div>
        </div>
      </div>
    </div>
  );
}
