import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoketoInvoice } from "./poketo";

export const ORDER_STATUS = [
  "draft",
  "quoted",
  "awaiting_dp",
  "in_progress",
  "review",
  "revision",
  "awaiting_final",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Brief diisi",
  quoted: "Penawaran dikirim",
  awaiting_dp: "Menunggu DP",
  in_progress: "Dikerjakan",
  review: "Review klien",
  revision: "Revisi",
  awaiting_final: "Menunggu pelunasan",
  completed: "Selesai",
  cancelled: "Batal",
};

/** Allowed moves, matching the state diagram in the PRD. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  draft: ["quoted", "cancelled"],
  quoted: ["awaiting_dp", "draft", "cancelled"],
  awaiting_dp: ["in_progress", "cancelled"],
  in_progress: ["review"],
  review: ["revision", "awaiting_final", "completed"],
  revision: ["review"],
  awaiting_final: ["completed"],
  completed: [],
  cancelled: [],
};

export function canMove(from: OrderStatus, to: OrderStatus) {
  return NEXT[from].includes(to);
}

/** Orders above Rp 1.000.000 pay 50% up front; smaller ones pay in full. */
export function splitPayment(total: number) {
  const dp = total > 1_000_000 ? Math.round(total / 2) : total;
  return { dp, final: total - dp };
}

/** Moves an order only if it is still in the expected status (safe against races). */
export async function moveOrder(db: SupabaseClient, orderId: string, to: OrderStatus) {
  const from = (Object.keys(NEXT) as OrderStatus[]).filter((s) => canMove(s, to));
  const { data, error } = await db
    .from("orders")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", from)
    .select("id, client_id, kode")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function notify(db: SupabaseClient, userId: string, orderId: string, tipe: string, pesan: string) {
  await db.from("notifications").insert({ user_id: userId, order_id: orderId, tipe, pesan });
}

/**
 * Applies a Poketo invoice state to our payment row and advances the order.
 * Idempotent: called from the webhook and from the check-status cron.
 * Must run with the service-role client.
 */
export async function applyInvoice(db: SupabaseClient, invoice: PoketoInvoice) {
  const { data: payment } = await db
    .from("payments")
    .select("id, order_id, tipe, status")
    .eq("poketo_invoice_id", invoice.id)
    .maybeSingle();
  if (!payment) return { handled: false, reason: "unknown invoice" };

  if (invoice.status !== "paid") {
    if (payment.status === "pending" || invoice.status === "refunded") {
      await db.from("payments").update({ status: invoice.status }).eq("id", payment.id);
    }
    return { handled: true };
  }

  // Only the first transition to "paid" advances the order.
  const { data: updated } = await db
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString(), metode: invoice.paymentMethod ?? null })
    .eq("id", payment.id)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();
  if (!updated) return { handled: true, duplicate: true };

  const to: OrderStatus | null =
    payment.tipe === "dp" || payment.tipe === "milestone"
      ? "in_progress"
      : payment.tipe === "final"
        ? "completed"
        : payment.tipe === "revisi"
          ? "revision"
          : null;

  if (to) {
    const order = await moveOrder(db, payment.order_id, to);
    if (order) {
      await notify(db, order.client_id, payment.order_id, "payment_paid", `Pembayaran ${order.kode} diterima.`);
    }
  }
  return { handled: true };
}
