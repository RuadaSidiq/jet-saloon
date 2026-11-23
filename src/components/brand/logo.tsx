/** Muv brand: a minimal solid-blue tile with a geometric white "m", and a lowercase wordmark. */
export function LogoMark({ size = 32, className = "", light = false }: { size?: number; className?: string; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Muv">
      <rect width="64" height="64" rx="18" fill={light ? "#ffffff" : "#1769D2"} />
      <path d="M17 44V28a7 7 0 0 1 14 0v16M31 28a7 7 0 0 1 14 0v16" fill="none" stroke={light ? "#1769D2" : "#ffffff"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 32 }: { light?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} light={light} />
      <span className={`text-[22px] font-bold leading-none tracking-[-0.04em] ${light ? "text-white" : "text-ink"}`}>muv</span>
    </span>
  );
}
