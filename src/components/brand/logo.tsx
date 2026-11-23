/** Jet Saloon brand mark: a flowing "J" with a jet-trail sweep and a sparkle, on a blue gradient tile. */
export function LogoMark({ size = 36, className = "", mono = false }: { size?: number; className?: string; mono?: boolean }) {
  const id = "jsg" + size + (mono ? "m" : "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Jet Saloon">
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B9AE8" />
          <stop offset=".55" stopColor="#1769D2" />
          <stop offset="1" stopColor="#123D75" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={mono ? "#ffffff" : `url(#${id})`} fillOpacity={mono ? 0.16 : 1} />
      {/* jet-trail sweep */}
      <path d="M13 24c7-4.5 15-6.2 22.5-5.4" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
      <path d="M15 31c6-3.2 12.5-4.4 19-3.8" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2.6" strokeLinecap="round" />
      {/* J */}
      <path d="M40 15v22.5c0 7.5-5.4 12.5-12.3 12.5-5.6 0-10-3.2-11.5-8.3" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkle */}
      <path d="M49.5 9.5c.6 3.4 1.9 4.7 5.3 5.3-3.4.6-4.7 1.9-5.3 5.3-.6-3.4-1.9-4.7-5.3-5.3 3.4-.6 4.7-1.9 5.3-5.3Z" fill="#fff" />
    </svg>
  );
}

export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} mono={light} className={light ? "" : "drop-shadow-[0_6px_14px_rgba(23,105,210,.45)]"} />
      <span className={`text-[17px] font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Jet <span className={light ? "text-white/80" : "text-brand"}>Saloon</span>
      </span>
    </span>
  );
}
