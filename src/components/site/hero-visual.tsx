import { CheckCircle2 } from "lucide-react";

/** Hero photo collage (Pexels, see public/images/CREDITS.md). An admin hero banner, if set, replaces the main photo. */
export function HeroVisual({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <div className="relative mx-auto grid h-[440px] w-full max-w-[540px] grid-cols-5 grid-rows-2 gap-3 sm:h-[520px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl ?? "/images/hero-makeup.jpg"} alt="A makeup artist applying makeup to a client" className="col-span-3 row-span-2 h-full w-full rounded-[32px] object-cover object-[62%_center] shadow-[0_30px_70px_-35px_rgba(18,61,117,.6)]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/hero-braids.jpg" alt="Braids being styled" className="col-span-2 h-full w-full rounded-[28px] object-cover object-top" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/hero-barber.jpg" alt="A barber giving a haircut" className="col-span-2 h-full w-full rounded-[28px] object-cover" />
      <div className="glass absolute -left-3 bottom-8 rounded-3xl p-3.5 pr-5 sm:-left-8" aria-hidden>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-2xl bg-ok-soft text-ok"><CheckCircle2 className="size-5" /></span>
          <div><p className="text-sm font-semibold text-ink">Booking confirmed</p><p className="text-xs text-muted">Sat, 10:00</p></div>
        </div>
      </div>
    </div>
  );
}
