import { applyInvoice } from "@/lib/orders";
import { checkInvoiceStatus } from "@/lib/poketo";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Backup for late webhooks: re-checks invoices still pending after 30 minutes.
// Call every 15 minutes with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const db = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: pending, error } = await db
    .from("payments")
    .select("poketo_invoice_id")
    .eq("status", "pending")
    .not("poketo_invoice_id", "is", null)
    .lt("created_at", cutoff)
    .limit(50);
  if (error) return new Response(error.message, { status: 500 });

  let settled = 0;
  for (const row of pending ?? []) {
    try {
      const invoice = await checkInvoiceStatus(row.poketo_invoice_id);
      if (invoice.status !== "pending") {
        await applyInvoice(db, invoice);
        settled++;
      }
    } catch (err) {
      console.error("check-status failed", row.poketo_invoice_id, err);
    }
  }
  return Response.json({ checked: pending?.length ?? 0, settled });
}
