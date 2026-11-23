import { CalendarCheck, CheckCircle2, Clock, Smartphone, Sparkles, Star } from "lucide-react";

/**
 * Illustrative product preview for the hero: shows what booking on Jet Saloon looks like.
 * Uses no real names, ratings or figures. If an admin uploads a hero banner image it fills the panel.
 */
export function HeroVisual({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[520px] lg:aspect-auto lg:h-[560px]" aria-hidden>
      <div className="absolute inset-0 overflow-hidden rounded-[40px] bg-gradient-to-br from-[#5b9ae8] via-brand to-brand-dark shadow-[0_40px_90px_-40px_rgba(18,61,117,.8)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute -left-20 -top-24 size-80 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 size-96 rounded-full bg-[#9cc3f5]/40 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.25),transparent_45%)]" />
            <svg className="absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 400 500" preserveAspectRatio="none">
              <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="white" /></pattern></defs>
              <rect width="400" height="500" fill="url(#dots)" />
            </svg>
            <div className="absolute inset-x-10 top-12 text-white/90">
              <Sparkles className="size-8" strokeWidth={1.5} />
              <p className="mt-4 max-w-[16rem] text-2xl font-semibold leading-snug text-white">Beauty, booked in minutes.</p>
              <p className="mt-2 max-w-[17rem] text-sm text-white/75">Makeup · Barbering · Braids · Nails · Lashes · Skincare</p>
            </div>
          </>
        )}
      </div>

      {/* floating glass cards */}
      <div className="glass absolute -left-4 bottom-40 w-64 rounded-3xl p-4 sm:-left-10">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-ok-soft text-ok"><CheckCircle2 className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Booking confirmed</p><p className="text-xs text-muted">Bridal makeup · Sat, 10:00</p></div>
        </div>
      </div>

      <div className="glass absolute -right-3 top-40 w-60 rounded-3xl p-4 sm:-right-8">
        <p className="flex items-center gap-2 text-xs font-medium text-muted"><Clock className="size-3.5" /> Open times today</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs font-medium">
          {["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"].map((t, i) => (
            <span key={t} className={`rounded-full py-1.5 text-center ${i === 1 ? "bg-brand text-white shadow-[0_4px_12px_-4px_rgba(23,105,210,.7)]" : "bg-white/80 text-ink"}`}>{t}</span>
          ))}
        </div>
      </div>

      <div className="glass absolute bottom-8 right-6 w-56 rounded-3xl p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#fff4d6] text-[#b7791f]"><Smartphone className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Pay with MoMo</p><p className="text-xs text-muted">or card · secure checkout</p></div>
        </div>
      </div>

      <div className="glass absolute bottom-10 left-8 hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink sm:flex">
        <CalendarCheck className="size-4 text-brand" /> Instant confirmation
      </div>
      <div className="glass absolute right-10 top-12 hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-ink sm:flex">
        <Star className="size-4 fill-amber-400 text-amber-400" /> Verified reviews only
      </div>
    </div>
  );
}
