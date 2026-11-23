import { NextResponse } from "next/server";
import { handleWebhook } from "@/server/modules/payments/service";
import { AppError } from "@/server/errors";

/** Gateway webhooks: POST /api/payments/webhook/paystack | flutterwave | dev */
export async function POST(req: Request, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;
  const raw = await req.text();
  try {
    const r = await handleWebhook(gateway, raw, req.headers);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof AppError && e.status < 500) return NextResponse.json({ ok: false, error: e.code }, { status: e.status });
    console.error("webhook", gateway, e);
    return NextResponse.json({ ok: false }, { status: 500 }); // gateway will retry
  }
}
