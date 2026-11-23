import "server-only"; // never bundle this module (or the secrets it reads) into browser code
/** Delivery drivers. Without credentials they log to the console (development) — never silently "succeed" in production. */
export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Muv <no-reply@example.com>";
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("Email provider not configured (RESEND_API_KEY)");
    console.info(`[email:dev] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Email send failed: HTTP ${res.status}`);
}

/** Hubtel SMS (Ghana). Add other country providers behind the same function signature. */
export async function sendSms(to: string, text: string) {
  const id = process.env.HUBTEL_SMS_CLIENT_ID;
  const secret = process.env.HUBTEL_SMS_CLIENT_SECRET;
  const sender = process.env.SMS_SENDER_ID ?? "Muv";
  if (!id || !secret) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS provider not configured");
    console.info(`[sms:dev] to=${to} ${text}`);
    return;
  }
  const u = new URL("https://smsc.hubtel.com/v1/messages/send");
  u.search = new URLSearchParams({ clientid: id, clientsecret: secret, from: sender, to, content: text }).toString();
  const res = await fetch(u);
  if (!res.ok) throw new Error(`SMS send failed: HTTP ${res.status}`);
}
