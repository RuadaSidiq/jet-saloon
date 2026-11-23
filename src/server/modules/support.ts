import { db } from "../db";
import { AppError, notFound } from "../errors";
import { reference } from "../crypto";
import { notify } from "../notify";

export const TICKET_CATEGORIES = ["BOOKING", "PAYMENT", "REFUND", "PROVIDER_COMPLAINT", "CUSTOMER_COMPLAINT", "ACCOUNT", "OTHER"] as const;

export async function openTicket(userId: string, d: { subject: string; category: string; body: string; bookingRef?: string }) {
  if (!TICKET_CATEGORIES.includes(d.category as never)) throw new AppError("CATEGORY", "Choose a category");
  if (d.subject.trim().length < 4 || d.body.trim().length < 10) throw new AppError("DETAIL", "Please describe the issue in a little more detail");
  let bookingId: string | undefined;
  if (d.bookingRef) {
    const b = await db.booking.findUnique({ where: { reference: d.bookingRef }, include: { provider: true } });
    if (!b || (b.customerId !== userId && b.provider.userId !== userId)) throw notFound("Booking");
    bookingId = b.id;
  }
  const priority = ["PAYMENT", "REFUND"].includes(d.category) ? "HIGH" : "NORMAL";
  return db.supportTicket.create({ data: { reference: reference("TK"), userId, bookingId, category: d.category, priority, subject: d.subject.trim().slice(0, 150), messages: { create: { authorId: userId, body: d.body.trim().slice(0, 5000) } } } });
}

export async function replyTicket(ticketId: string, authorId: string, body: string, opts: { asStaff: boolean; internal?: boolean }) {
  const t = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t || (!opts.asStaff && t.userId !== authorId)) throw notFound("Ticket");
  if (body.trim().length < 1) throw new AppError("EMPTY", "Write a reply");
  await db.ticketMessage.create({ data: { ticketId, authorId, body: body.trim().slice(0, 5000), internal: !!(opts.asStaff && opts.internal) } });
  if (opts.asStaff && !opts.internal) {
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "WAITING_ON_USER" } });
    await notify(t.userId, "support.updated", `Update on ticket ${t.reference}`, body.slice(0, 200), `/account/support/${t.reference}`);
  } else if (!opts.asStaff) {
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "OPEN" } });
  }
}
