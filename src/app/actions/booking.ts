"use server";
import { z } from "zod";
import type { ActionResult } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { cancelBooking, createBooking, requestReschedule, rescheduleBooking } from "@/server/modules/bookings";
import { initiatePayment } from "@/server/modules/payments/service";
import { createReview, reportReview } from "@/server/modules/reviews";
import { sendMessage } from "@/server/modules/messaging";
import { openTicket, replyTicket } from "@/server/modules/support";
import { rateLimit } from "@/server/ratelimit";
import { run, str } from "./_run";

const bookingSchema = z.object({
  providerId: z.string().min(1), serviceIds: z.array(z.string()).min(1, "Choose a service"), startsAt: z.string().min(1, "Choose a time"),
  staffId: z.string().optional(), locationType: z.enum(["STUDIO", "HOME"]), homeAddress: z.string().optional(), homeCityId: z.string().optional(),
  couponCode: z.string().optional(), note: z.string().max(1000).optional(), idempotencyKey: z.string().min(8),
});

export async function createBookingAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await rateLimit(`book:${u.id}`, 20, 600);
    const d = bookingSchema.parse({
      providerId: str(fd, "providerId"), serviceIds: fd.getAll("serviceIds").map(String), startsAt: str(fd, "startsAt"), staffId: str(fd, "staffId") || undefined,
      locationType: str(fd, "locationType") || "STUDIO", homeAddress: str(fd, "homeAddress") || undefined, homeCityId: str(fd, "homeCityId") || undefined,
      couponCode: str(fd, "couponCode") || undefined, note: str(fd, "note") || undefined, idempotencyKey: str(fd, "idempotencyKey"),
    });
    const b = await createBooking({ ...d, customerId: u.id });
    if (b.status === "PENDING_PAYMENT") {
      const p = await initiatePayment(b.reference, u.id);
      return { ok: true, data: { redirect: p.authorizationUrl } };
    }
    return { ok: true, data: { redirect: `/account/bookings/${b.reference}` } };
  });
}

export async function payAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const p = await initiatePayment(str(fd, "ref"), u.id);
    return { ok: true, data: { redirect: p.authorizationUrl } };
  });
}

export async function customerCancelAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const r = await cancelBooking(str(fd, "ref"), u, "customer", str(fd, "reason") || "Cancelled by customer");
    return { ok: true, message: r.refunded ? "Booking cancelled. Your refund has been initiated." : "Booking cancelled." };
  });
}

export async function rescheduleRequestAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const as = str(fd, "as") === "provider" ? "provider" : "customer";
    await requestReschedule(str(fd, "ref"), u, as, str(fd, "note") || "Please suggest another time");
    return { ok: true, message: "Request sent." };
  });
}

export async function rescheduleAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const as = str(fd, "as") === "provider" ? "provider" : "customer";
    await rescheduleBooking(str(fd, "ref"), u, as, str(fd, "startsAt"));
    return { ok: true, message: "Booking moved to the new time." };
  });
}

export async function reviewAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await rateLimit(`review:${u.id}`, 10, 3600);
    await createReview(u.id, str(fd, "ref"), Number(fd.get("rating")), str(fd, "comment"));
    return { ok: true, message: "Thanks for your review!" };
  });
}

export async function reportReviewAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await reportReview(u.id, str(fd, "reviewId"), str(fd, "reason") || "Inappropriate");
    return { ok: true, message: "Reported to our moderation team." };
  });
}

export async function messageAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await sendMessage(str(fd, "ref"), u.id, str(fd, "body"));
  });
}

export async function toggleFavouriteAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    const providerId = str(fd, "providerId");
    const key = { customerId_providerId: { customerId: u.id, providerId } };
    if (await db.favourite.findUnique({ where: key })) await db.favourite.delete({ where: key });
    else {
      const p = await db.providerProfile.findFirst({ where: { id: providerId, status: "APPROVED" } });
      if (p) await db.favourite.create({ data: { customerId: u.id, providerId } });
    }
  });
}

export async function openTicketAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await rateLimit(`ticket:${u.id}`, 10, 3600);
    const t = await openTicket(u.id, { subject: str(fd, "subject"), category: str(fd, "category"), body: str(fd, "body"), bookingRef: str(fd, "bookingRef") || undefined });
    return { ok: true, data: { redirect: `/account/support/${t.reference}` } };
  });
}

export async function ticketReplyAction(_: ActionResult | null, fd: FormData) {
  return run(async () => {
    const u = await requireUser();
    await replyTicket(str(fd, "ticketId"), u.id, str(fd, "body"), { asStaff: false });
  });
}
