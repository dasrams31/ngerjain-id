"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendMessage, type FormState } from "@/app/order/actions";
import { formatTanggal } from "@/lib/format";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export type ChatMessage = { id: string; sender_id: string; body: string; created_at: string };

export function OrderChat({
  orderId,
  viewerId,
  initial,
}: {
  orderId: string;
  viewerId: string;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage.bind(null, orderId), {});
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  return (
    <section className="panel flex h-[32rem] flex-col p-0" aria-label="Chat order">
      <h2 className="border-b border-line px-5 py-3 font-semibold">Chat</h2>
      <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 && <li className="text-sm text-muted">Belum ada pesan. Tanyakan apa saja soal brief kamu.</li>}
        {messages.map((m) => {
          const mine = m.sender_id === viewerId;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  mine ? "bg-ink text-paper" : "border border-line bg-paper"
                }`}
              >
                {m.body}
              </p>
              <span className="mt-1 text-[11px] text-muted">{formatTanggal(m.created_at)}</span>
            </li>
          );
        })}
      </ol>
      {/* React resets the form after the action finishes. */}
      <form action={action} className="flex gap-2 border-t border-line p-3">
        <label htmlFor="chat-body" className="sr-only">
          Tulis pesan
        </label>
        <input id="chat-body" name="body" autoComplete="off" required maxLength={4000} className="field" placeholder="Tulis pesan..." />
        <button type="submit" disabled={pending} className="btn-primary shrink-0">
          Kirim
        </button>
      </form>
      {state.message && <p className="px-5 pb-3 text-sm text-red-700">{state.message}</p>}
    </section>
  );
}
