import { applyInvoice } from "@/lib/orders";
import { verifyWebhookSignature, type PoketoInvoice } from "@/lib/poketo";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Poketo retries on 5xx, 408, 429, and timeouts, and expects a 2xx within 10 seconds.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.POKETO_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook secret not configured", { status: 500 });

  if (!verifyWebhookSignature(rawBody, request.headers.get("poketo-signature"), secret)) {
    return new Response("invalid signature", { status: 400 });
  }

  const eventId = request.headers.get("poketo-event-id");
  const event = request.headers.get("poketo-event") ?? "unknown";
  if (!eventId) return new Response("missing event id", { status: 400 });

  const payload = JSON.parse(rawBody);
  const db = createSupabaseAdmin();

  // Dedupe: the same event id arrives again on retries.
  const { error: insertError } = await db
    .from("webhook_events")
    .insert({ poketo_event_id: eventId, tipe: event, payload });
  if (insertError) {
    if (insertError.code === "23505") return Response.json({ ok: true, duplicate: true });
    return new Response("could not record event", { status: 500 });
  }

  if (event.startsWith("invoice.")) {
    const invoice = (payload?.data ?? payload) as PoketoInvoice;
    try {
      await applyInvoice(db, invoice);
    } catch (err) {
      // Let Poketo retry: forget the event so the retry is not treated as a duplicate.
      await db.from("webhook_events").delete().eq("poketo_event_id", eventId);
      console.error("poketo webhook failed", eventId, err);
      return new Response("processing failed", { status: 500 });
    }
  }

  await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("poketo_event_id", eventId);
  return Response.json({ ok: true });
}
