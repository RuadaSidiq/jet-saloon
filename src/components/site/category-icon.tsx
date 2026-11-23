import { Brush, Droplet, Eye, Feather, Flower2, Hand, HeartHandshake, Palette, PenTool, Scissors, Sparkles, Star, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  palette: Palette, scissors: Scissors, sparkles: Sparkles, eye: Eye, hand: Hand, droplet: Droplet, brush: Brush,
  "heart-handshake": HeartHandshake, flower: Flower2, feather: Feather, "pen-tool": PenTool, star: Star,
};
const TINTS = ["from-[#e8f1ff] to-[#d4e5ff] text-brand", "from-[#fde8ef] to-[#fbd5e2] text-[#c2416b]", "from-[#e9f7f0] to-[#d3f0e2] text-[#1f8a5b]", "from-[#fff3e2] to-[#ffe5c2] text-[#b86a12]", "from-[#efeaff] to-[#e0d7ff] text-[#6a4fd1]", "from-[#e6f6fb] to-[#cfeef8] text-[#13809e]"];

export function CategoryIcon({ icon, index, size = "md" }: { icon?: string | null; index: number; size?: "md" | "lg" }) {
  const Icon = (icon && MAP[icon]) || Sparkles;
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${TINTS[index % TINTS.length]} ${size === "lg" ? "size-14" : "size-11"}`}>
      <Icon className={size === "lg" ? "size-7" : "size-5"} strokeWidth={1.7} aria-hidden />
    </span>
  );
}
