import type { Metadata } from "next";
import { Suspense } from "react";
import { requireViewer } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { BriefForm } from "./brief-form";

export const metadata: Metadata = { title: "Brief baru" };

export default function NewOrderPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Ceritakan project kamu</h1>
      <p className="mt-2 text-muted">Penawaran harga dikirim lewat halaman order, biasanya dalam 1x24 jam.</p>
      <Suspense fallback={<p className="mt-8 text-muted">Memuat form...</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  await requireViewer();
  const supabase = await createSupabaseServer();
  const { data: services } = await supabase.from("services").select("id, nama").eq("aktif", true).order("harga_mulai");
  return <BriefForm services={services ?? []} />;
}
