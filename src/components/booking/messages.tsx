"use client";
import { messageAction } from "@/app/actions/booking";
import { ActionForm, Submit } from "@/components/ui/form";
import { Textarea } from "@/components/ui";

export function Messages({ bookingRef, me, messages }: { bookingRef: string; me: string; messages: { id: string; body: string; createdAt: string; sender: { id: string; name: string } }[] }) {
  return (
    <div>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 && <li className="text-sm text-muted">No messages yet. Use this to share details about your appointment.</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.sender.id === me ? "text-right" : ""}>
            <div className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-sm ${m.sender.id === me ? "bg-brand text-white" : "bg-canvas"}`}>{m.body}</div>
            <p className="mt-0.5 text-[11px] text-muted">{m.sender.id === me ? "You" : m.sender.name.split(" ")[0]} · {new Date(m.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p>
          </li>
        ))}
      </ul>
      <ActionForm action={messageAction} resetOnSuccess className="mt-3">
        <input type="hidden" name="ref" value={bookingRef} />
        <Textarea name="body" rows={2} required maxLength={2000} placeholder="Write a message…" />
        <div className="mt-2 text-right"><Submit size="sm" pendingText="Sending…">Send</Submit></div>
      </ActionForm>
    </div>
  );
}
