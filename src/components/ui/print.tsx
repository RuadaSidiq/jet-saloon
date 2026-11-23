"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="no-print rounded-2xl border border-line px-3 py-1.5 text-sm">Print / Save PDF</button>;
}
