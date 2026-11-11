"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireViewer } from "@/lib/auth";
import { moveOrder, notify, splitPayment } from "@/lib/orders";
import { createInvoice, simulateInvoice } from "@/lib/poketo";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";

export type FormState = { message?: string };

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Loads an order the viewer may see (RLS decides). Throws if not visible. */
async function loadOrder(orderId: string) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("orders")
    .select("id, kode, judul, status, client_id, total, revisi_kuota, revisi_terpakai")
    .eq("id", orderId)
    .single();
  if (!data) throw new Error("Order tidak ditemukan");
  return data;
}

// ---------------------------------------------------------------------------
// Client actions
// ---------------------------------------------------------------------------

const briefSchema = z.object({
  service_id: z.uuid().optional().or(z.literal("")),
  judul: z.string().trim().min(5, "Judul minimal 5 karakter").max(120),
  deskripsi: z.string().trim().min(30, "Ceritakan kebutuhanmu minimal 30 karakter").max(5000),
  deadline: z.iso.date().optional().or(z.literal("")),
  budget: z.coerce.number().int().min(0).optional(),
  setuju: z.literal("on", { error: "Centang persetujuan batas layanan" }),
});

export async function createOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = briefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Brief belum lengkap" };
  const b = parsed.data;

  const supabase = await createSupabaseServer();
  let revisiKuota = 2;
  if (b.service_id) {
    const { data: service } = await supabase.from("services").select("revisi_default").eq("id", b.service_id).single();
    revisiKuota = service?.revisi_default ?? 2;
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      client_id: viewer.id,
      service_id: b.service_id || null,
      judul: b.judul,
      brief: { deskripsi: b.deskripsi, budget: b.budget ?? null },
      deadline: b.deadline || null,
      revisi_kuota: revisiKuota,
    })
    .select("id")
    .single();
  if (error || !data) return { message: "Gagal menyimpan brief. Coba lagi." };

  redirect(`/order/${data.id}`);
}

export async function sendMessage(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return {};
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("messages").insert({ order_id: orderId, sender_id: viewer.id, body });
  return error ? { message: "Pesan gagal terkirim." } : {};
}

export async function acceptQuote(orderId: string) {
  const viewer = await requireViewer();
  const order = await loadOrder(orderId);
  if (order.client_id !== viewer.id || order.status !== "quoted") throw new Error("Penawaran tidak bisa diterima");

  const db = createSupabaseAdmin();
  const { data: quote } = await db
    .from("quotes")
    .select("id, total, expires_at")
    .eq("order_id", orderId)
    .eq("status", "sent")
    .order("versi", { ascending: false })
    .limit(1)
    .single();
  if (!quote || new Date(quote.expires_at) < new Date()) throw new Error("Penawaran sudah kedaluwarsa");

  const { dp } = splitPayment(quote.total);
  await db.from("quotes").update({ status: "accepted" }).eq("id", quote.id);
  await db.from("orders").update({ total: quote.total }).eq("id", orderId);
  await db.from("payments").insert({ order_id: orderId, tipe: "dp", amount: dp });
  await moveOrder(db, orderId, "awaiting_dp");
  refresh();
}

export async function rejectQuote(orderId: string) {
  const viewer = await requireViewer();
  const order = await loadOrder(orderId);
  if (order.client_id !== viewer.id || order.status !== "quoted") throw new Error("Penawaran tidak bisa ditolak");

  const db = createSupabaseAdmin();
  await db.from("quotes").update({ status: "rejected" }).eq("order_id", orderId).eq("status", "sent");
  await moveOrder(db, orderId, "draft");
  refresh();
}

/** Creates (or reuses) the Poketo invoice for a payment and returns its checkout URL. */
export async function startPayment(paymentId: string): Promise<{ url?: string; error?: string }> {
  const viewer = await requireViewer();
  const supabase = await createSupabaseServer();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, tipe, amount, status, payment_url, orders(kode, judul)")
    .eq("id", paymentId)
    .single();
  if (!payment || payment.status !== "pending") return { error: "Tagihan tidak aktif." };
  if (payment.payment_url) return { url: payment.payment_url };

  const order = payment.orders as unknown as { kode: string; judul: string };
  try {
    const invoice = await createInvoice(
      {
        amount: payment.amount,
        title: `${order.kode} - ${payment.tipe.toUpperCase()}`,
        description: order.judul,
        customer: { name: viewer.nama, email: viewer.email },
        referenceId: payment.id,
        redirectUrl: `${site()}/order/${payment.order_id}`,
        expiresInMinutes: 1440,
      },
      `payment-${payment.id}`,
    );
    const db = createSupabaseAdmin();
    await db
      .from("payments")
      .update({ poketo_invoice_id: invoice.id, payment_url: invoice.paymentUrl })
      .eq("id", payment.id);
    return { url: invoice.paymentUrl };
  } catch (err) {
    console.error("createInvoice failed", err);
    return { error: "Gagal membuat tagihan. Coba lagi sebentar lagi." };
  }
}

export async function approveResult(orderId: string) {
  const viewer = await requireViewer();
  const order = await loadOrder(orderId);
  if (order.client_id !== viewer.id || order.status !== "review") throw new Error("Hasil belum bisa disetujui");

  const db = createSupabaseAdmin();
  const { final } = splitPayment(order.total ?? 0);
  if (final > 0) {
    await db.from("payments").insert({ order_id: orderId, tipe: "final", amount: final });
    await moveOrder(db, orderId, "awaiting_final");
  } else {
    await moveOrder(db, orderId, "completed");
  }
  refresh();
}

export async function requestRevision(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const order = await loadOrder(orderId);
  if (order.client_id !== viewer.id || order.status !== "review") return { message: "Revisi hanya bisa saat review." };

  const permintaan = String(formData.get("permintaan") ?? "").trim();
  if (permintaan.length < 10) return { message: "Jelaskan revisinya minimal 10 karakter." };

  const db = createSupabaseAdmin();
  const nomor = order.revisi_terpakai + 1;
  const berbayar = order.revisi_terpakai >= order.revisi_kuota;
  await db.from("revisions").insert({ order_id: orderId, nomor, permintaan, berbayar });

  if (berbayar) {
    // Outside the quota: bill 10% of the order (min Rp 50.000); the order moves once it is paid.
    const amount = Math.max(50_000, Math.round((order.total ?? 0) * 0.1));
    await db.from("payments").insert({ order_id: orderId, tipe: "revisi", amount });
  } else {
    await db.from("orders").update({ revisi_terpakai: nomor }).eq("id", orderId);
    await moveOrder(db, orderId, "revision");
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

const quoteSchema = z.object({
  total: z.coerce.number().int().min(10_000, "Minimal Rp 10.000"),
  catatan: z.string().trim().max(2000).default(""),
  revisi_kuota: z.coerce.number().int().min(0).max(10),
  milestones: z.string().trim().min(1, "Isi minimal satu milestone"),
});

export async function sendQuote(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const q = parsed.data;

  const db = createSupabaseAdmin();
  const { data: order } = await db.from("orders").select("client_id, kode, status").eq("id", orderId).single();
  if (!order || order.status !== "draft") return { message: "Penawaran hanya untuk order berstatus draft." };

  const { count } = await db.from("quotes").select("id", { count: "exact", head: true }).eq("order_id", orderId);
  await db.from("quotes").insert({ order_id: orderId, versi: (count ?? 0) + 1, total: q.total, catatan: q.catatan });

  const judul = q.milestones.split("\n").map((s) => s.trim()).filter(Boolean);
  await db.from("milestones").delete().eq("order_id", orderId);
  await db.from("milestones").insert(judul.map((j, i) => ({ order_id: orderId, judul: j, urutan: i + 1 })));
  await db.from("orders").update({ revisi_kuota: q.revisi_kuota }).eq("id", orderId);

  await moveOrder(db, orderId, "quoted");
  await notify(db, order.client_id, orderId, "quote_sent", `Penawaran untuk ${order.kode} sudah dikirim.`);
  refresh();
  return {};
}

export async function postProgress(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const catatan = String(formData.get("catatan") ?? "").trim();
  const milestoneId = String(formData.get("milestone_id") ?? "") || null;
  const persen = Number(formData.get("persen") ?? 0);
  const previewUrl = String(formData.get("preview_url") ?? "").trim() || null;
  if (!catatan) return { message: "Catatan progres wajib diisi." };

  const db = createSupabaseAdmin();
  await db.from("progress_updates").insert({
    order_id: orderId,
    milestone_id: milestoneId,
    catatan,
    preview_url: previewUrl,
    created_by: admin.id,
  });
  if (milestoneId) {
    const p = Math.min(100, Math.max(0, persen));
    await db
      .from("milestones")
      .update({ persen: p, status: p >= 100 ? "done" : p > 0 ? "doing" : "todo" })
      .eq("id", milestoneId);
  }
  refresh();
  return {};
}

export async function submitForReview(orderId: string) {
  await requireAdmin();
  const db = createSupabaseAdmin();
  const order = await moveOrder(db, orderId, "review");
  if (order) await notify(db, order.client_id, orderId, "review_ready", `Hasil ${order.kode} siap direview.`);
  refresh();
}

/** Sandbox helper: pays a pending invoice without real money. Disabled with live keys. */
export async function simulatePaid(paymentId: string) {
  await requireAdmin();
  if (!process.env.POKETO_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Hanya untuk sandbox");
  const db = createSupabaseAdmin();
  const { data: payment } = await db.from("payments").select("poketo_invoice_id").eq("id", paymentId).single();
  if (!payment?.poketo_invoice_id) throw new Error("Buat tagihan dulu (klik Bayar) sebelum simulasi.");
  await simulateInvoice(payment.poketo_invoice_id, "paid");
  // The invoice.paid webhook advances the order.
  refresh();
}
