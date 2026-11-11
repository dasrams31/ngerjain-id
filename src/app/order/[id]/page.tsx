import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderChat } from "@/components/order-chat";
import { ProgressForm, QuoteForm, RevisionForm } from "@/components/order-forms";
import { OrderLive } from "@/components/order-live";
import { PayButton } from "@/components/pay-button";
import { StatusBadge } from "@/components/status-badge";
import { requireViewer } from "@/lib/auth";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { acceptQuote, approveResult, rejectQuote, simulatePaid, submitForReview } from "../actions";

const PAYMENT_LABEL: Record<string, string> = {
  dp: "DP",
  final: "Pelunasan",
  milestone: "Milestone",
  revisi: "Revisi tambahan",
  langganan: "Langganan",
};

export default function OrderPage({ params }: PageProps<"/order/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
        ← Semua order
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Memuat order...</p>}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createSupabaseServer();

  const [{ data: order }, { data: quotes }, { data: milestones }, { data: progress }, { data: payments }, { data: messages }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("quotes").select("*").eq("order_id", id).order("versi", { ascending: false }).limit(1),
      supabase.from("milestones").select("*").eq("order_id", id).order("urutan"),
      supabase.from("progress_updates").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("order_id", id).order("created_at"),
      supabase.from("messages").select("id, sender_id, body, created_at").eq("order_id", id).order("created_at").limit(200),
    ]);
  if (!order) notFound();

  const isAdmin = viewer.role === "admin";
  const isClient = order.client_id === viewer.id;
  const quote = quotes?.[0];
  const pendingPayments = (payments ?? []).filter((p) => p.status === "pending");
  const sandbox = process.env.POKETO_SECRET_KEY?.startsWith("sk_test_") ?? false;

  return (
    <div className="mt-4">
      <OrderLive orderId={order.id} />

      <header className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-muted">{order.kode}</span>
        <StatusBadge status={order.status} />
        {order.total ? <span className="text-sm text-muted">Total {formatRupiah(order.total)}</span> : null}
      </header>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">{order.judul}</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {/* Quote waiting for the client */}
          {order.status === "quoted" && quote && (
            <section className="panel border-accent/50">
              <h2 className="font-semibold">Penawaran</h2>
              <p className="mt-2 text-3xl font-bold">{formatRupiah(quote.total)}</p>
              {quote.catatan && <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{quote.catatan}</p>}
              <p className="mt-2 text-xs text-muted">
                Berlaku sampai {formatTanggal(quote.expires_at)} · {order.revisi_kuota}x revisi gratis
              </p>
              {isClient && (
                <div className="mt-4 flex gap-2">
                  <form action={acceptQuote.bind(null, order.id)}>
                    <button className="btn-accent">Terima dan lanjut bayar</button>
                  </form>
                  <form action={rejectQuote.bind(null, order.id)}>
                    <button className="btn-ghost">Tolak</button>
                  </form>
                </div>
              )}
            </section>
          )}

          {/* Unpaid invoices */}
          {pendingPayments.map((p) => (
            <section key={p.id} className="panel flex flex-wrap items-center justify-between gap-4 border-accent/50">
              <div>
                <h2 className="font-semibold">Tagihan {PAYMENT_LABEL[p.tipe] ?? p.tipe}</h2>
                <p className="text-2xl font-bold">{formatRupiah(p.amount)}</p>
                <p className="text-xs text-muted">QRIS, virtual account, PayLater, atau kartu debit. Biaya metode dibayar pembeli.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isClient && <PayButton paymentId={p.id} label="Bayar sekarang" />}
                {isAdmin && sandbox && (
                  <form action={simulatePaid.bind(null, p.id)}>
                    <button className="btn-ghost text-xs">Simulasi lunas (sandbox)</button>
                  </form>
                )}
              </div>
            </section>
          ))}

          {/* Client review */}
          {order.status === "review" && isClient && (
            <section className="panel space-y-4">
              <h2 className="font-semibold">Hasil siap direview</h2>
              <form action={approveResult.bind(null, order.id)}>
                <button className="btn-accent">Setujui hasil</button>
              </form>
              <RevisionForm orderId={order.id} sisa={Math.max(0, order.revisi_kuota - order.revisi_terpakai)} />
            </section>
          )}

          {/* Admin tools */}
          {isAdmin && order.status === "draft" && (
            <section className="panel">
              <h2 className="mb-4 font-semibold">Kirim penawaran</h2>
              <QuoteForm orderId={order.id} />
            </section>
          )}
          {isAdmin && (order.status === "in_progress" || order.status === "revision") && (
            <section className="panel space-y-4">
              <h2 className="font-semibold">Update progres</h2>
              <ProgressForm orderId={order.id} milestones={milestones ?? []} />
              <form action={submitForReview.bind(null, order.id)} className="border-t border-line pt-4">
                <button className="btn-accent">Kirim hasil untuk direview</button>
              </form>
            </section>
          )}

          {/* Milestones */}
          {!!milestones?.length && (
            <section className="panel">
              <h2 className="font-semibold">Milestone</h2>
              <ol className="mt-4 space-y-4">
                {milestones.map((m) => (
                  <li key={m.id}>
                    <div className="flex justify-between text-sm">
                      <span className={m.status === "done" ? "text-muted line-through" : "font-medium"}>{m.judul}</span>
                      <span className="font-mono text-muted">{m.persen}%</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-line" role="progressbar" aria-valuenow={m.persen} aria-valuemin={0} aria-valuemax={100} aria-label={m.judul}>
                      <div className="h-2 rounded-full bg-accent transition-[width]" style={{ width: `${m.persen}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Progress timeline */}
          <section className="panel">
            <h2 className="font-semibold">Riwayat progres</h2>
            {progress?.length ? (
              <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
                {progress.map((u) => (
                  <li key={u.id} className="relative">
                    <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-card bg-accent" />
                    <p className="text-xs text-muted">{formatTanggal(u.created_at)}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{u.catatan}</p>
                    {u.preview_url && (
                      <a href={u.preview_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-medium underline underline-offset-2">
                        Lihat preview
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">Belum ada update. Progres muncul di sini begitu pengerjaan dimulai.</p>
            )}
          </section>

          {/* Brief */}
          <section className="panel">
            <h2 className="font-semibold">Brief</h2>
            <p className="mt-2 text-sm whitespace-pre-wrap">{order.brief?.deskripsi}</p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {order.deadline && (
                <div>
                  <dt className="text-muted">Deadline</dt>
                  <dd>{order.deadline}</dd>
                </div>
              )}
              {order.brief?.budget ? (
                <div>
                  <dt className="text-muted">Budget</dt>
                  <dd>{formatRupiah(order.brief.budget)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <OrderChat orderId={order.id} viewerId={viewer.id} initial={messages ?? []} />
        </aside>
      </div>
    </div>
  );
}
