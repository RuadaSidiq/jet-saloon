import { notFound } from "next/navigation";
import { getSetting } from "@/server/modules/settings";

const DOCS = { terms: ["Terms of Service", "legal.terms"], privacy: ["Privacy Policy", "legal.privacy"], refunds: ["Refund Policy", "legal.refundPolicy"] } as const;

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc as keyof typeof DOCS];
  if (!d) notFound();
  const body = await getSetting(d[1]);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">{d[0]}</h1>
      <div className="mt-6 whitespace-pre-line text-sm leading-relaxed">{body || "This document is being prepared. Please contact support with any questions."}</div>
    </article>
  );
}
