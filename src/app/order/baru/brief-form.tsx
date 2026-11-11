"use client";

import { useActionState } from "react";
import { createOrder, type FormState } from "../actions";

export function BriefForm({ services }: { services: { id: string; nama: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createOrder, {});

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="service_id" className="label">
          Layanan
        </label>
        <select id="service_id" name="service_id" className="field">
          <option value="">Belum yakin, bantu pilihkan</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="judul" className="label">
          Judul singkat
        </label>
        <input id="judul" name="judul" required minLength={5} maxLength={120} className="field" placeholder="Contoh: Toko online untuk usaha kopi" />
      </div>

      <div>
        <label htmlFor="deskripsi" className="label">
          Kebutuhan
        </label>
        <textarea
          id="deskripsi"
          name="deskripsi"
          required
          minLength={30}
          rows={7}
          className="field"
          placeholder="Apa yang mau dibuat, fitur wajib, contoh referensi, data yang sudah ada..."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="deadline" className="label">
            Deadline
          </label>
          <input id="deadline" name="deadline" type="date" className="field" />
        </div>
        <div>
          <label htmlFor="budget" className="label">
            Budget (Rp, opsional)
          </label>
          <input id="budget" name="budget" type="number" min={0} step={50000} inputMode="numeric" className="field" />
        </div>
      </div>

      <label className="flex gap-3 rounded-xl border border-line bg-card p-4 text-sm">
        <input type="checkbox" name="setuju" required className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          Saya paham ngerjain.id membantu lewat pembuatan, bimbingan, dan review. Tugas, ujian, atau paper yang
          dikumpulkan atas nama saya tidak dikerjakan.
        </span>
      </label>

      {state.message && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-accent w-full py-3 text-base">
        {pending ? "Menyimpan..." : "Kirim brief"}
      </button>
    </form>
  );
}
