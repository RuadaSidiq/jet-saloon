import { Brush, Droplet, Eye, Feather, Flower2, Hand, HeartHandshake, Palette, PenTool, Scissors, Sparkles, Star, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  palette: Palette, scissors: Scissors, sparkles: Sparkles, eye: Eye, hand: Hand, droplet: Droplet, brush: Brush,
  "heart-handshake": HeartHandshake, flower: Flower2, feather: Feather, "pen-tool": PenTool, star: Star,
};
const TINTS = ["bg-brand-soft text-brand"];

export function CategoryIcon({ icon, index, size = "md" }: { icon?: string | null; index: number; size?: "md" | "lg" }) {
  const Icon = (icon && MAP[icon]) || Sparkles;
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl ${TINTS[index % TINTS.length]} ${size === "lg" ? "size-14" : "size-11"}`}>
      <Icon className={size === "lg" ? "size-7" : "size-5"} strokeWidth={1.7} aria-hidden />
    </span>
  );
}
