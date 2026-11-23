import { db } from "../db";
import { AppError, notFound } from "../errors";
import { rateLimit } from "../ratelimit";
import { notify } from "../notify";

/** Conversations are tied to a booking; only its customer and provider may participate. */
async function participants(bookingRef: string, userId: string) {
  const b = await db.booking.findUnique({ where: { reference: bookingRef }, include: { provider: true } });
  if (!b || (b.customerId !== userId && b.provider.userId !== userId)) throw notFound("Conversation");
  return b;
}

export async function getConversation(bookingRef: string, userId: string) {
  const b = await participants(bookingRef, userId);
  const c = await db.conversation.upsert({ where: { bookingId: b.id }, update: {}, create: { bookingId: b.id } });
  const messages = await db.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } }, take: 200 });
  return { booking: b, conversation: c, messages };
}

export async function sendMessage(bookingRef: string, userId: string, body: string, attachmentUrl?: string) {
  await rateLimit(`msg:${userId}`, 30, 60);
  const text = body.trim();
  if (!text && !attachmentUrl) throw new AppError("EMPTY", "Write a message");
  const { booking, conversation } = await getConversation(bookingRef, userId);
  const m = await db.message.create({ data: { conversationId: conversation.id, senderId: userId, body: text.slice(0, 2000), attachmentUrl } });
  const to = userId === booking.customerId ? booking.provider.userId : booking.customerId;
  await notify(to, "message.new", "New message", `About booking ${booking.reference}: ${text.slice(0, 120)}`, to === booking.customerId ? `/account/bookings/${booking.reference}` : `/business/bookings/${booking.reference}`);
  return m;
}

export async function reportMessage(messageId: string, userId: string) {
  const m = await db.message.findUnique({ where: { id: messageId }, include: { conversation: { include: { booking: { include: { provider: true } } } } } });
  const b = m?.conversation.booking;
  if (!m || !b || (b.customerId !== userId && b.provider.userId !== userId)) throw notFound("Message");
  await db.message.update({ where: { id: m.id }, data: { reportedAt: new Date() } });
}
