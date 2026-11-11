import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { requireViewer } from "@/lib/auth";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Suspense fallback={<p className="text-muted">Memuat order...</p>}>
        <Orders />
      </Suspense>
    </main>
  );
}

async function Orders() {
  const viewer = await requireViewer();
  const supabase = await createSupabaseServer();
  // RLS returns only the viewer's orders (or every order for an admin).
  const { data: orders } = await supabase
    .from("orders")
    .select("id, kode, judul, status, total, created_at, payments(amount, status)")
    .order("created_at", { ascending: false });

  const unpaid = (orders ?? []).flatMap((o) => o.payments ?? []).filter((p) => p.status === "pending");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{viewer.role === "admin" ? "Admin" : "Halo"}</p>
          <h1 className="text-3xl font-bold tracking-tight">{viewer.nama || viewer.email}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/order/baru" className="btn-accent">
            Brief baru
          </Link>
          <form action={signOut}>
            <button className="btn-ghost">Keluar</button>
          </form>
        </div>
      </div>

      {unpaid.length > 0 && (
        <p className="panel mt-6 border-accent/40 text-sm">
          {unpaid.length} tagihan menunggu pembayaran, total{" "}
          <strong>{formatRupiah(unpaid.reduce((s, p) => s + p.amount, 0))}</strong>.
        </p>
      )}

      {!orders?.length ? (
        <div className="panel mt-8 text-center">
          <p className="font-semibold">Belum ada order.</p>
          <p className="mt-1 text-sm text-muted">Kirim brief pertama, penawaran biasanya datang dalam 1x24 jam.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-paper/60">
                <span className="font-mono text-xs text-muted">{o.kode}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{o.judul}</span>
                {o.total ? <span className="text-sm">{formatRupiah(o.total)}</span> : null}
                <StatusBadge status={o.status} />
                <span className="w-full text-xs text-muted sm:w-auto">{formatTanggal(o.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
