import Link from "next/link";
import type { Booking, BookingItem } from "@prisma/client";
import { dt, money } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

export function BookingRow({ b, href }: { b: Booking & { items: BookingItem[] }; href: string }) {
  return (
    <li>
      <Link href={href} className="flex flex-col gap-1 glass glass-hover rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1">
          <p className="font-medium">{b.items.map((i) => i.nameSnapshot).join(", ")}</p>
          <p className="text-sm text-muted">{b.providerNameSnapshot} · {dt(b.startsAt, b.timezone)}</p>
        </div>
        <span className="tabular text-sm font-medium">{money(b.totalMinor, b.currency)}</span>
        <StatusBadge status={b.status} />
      </Link>
    </li>
  );
}
