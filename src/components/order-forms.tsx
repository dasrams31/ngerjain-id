"use client";

import { useActionState } from "react";
import { postProgress, requestRevision, sendQuote, type FormState } from "@/app/order/actions";

function Message({ state }: { state: FormState }) {
  return state.message ? (
    <p role="alert" className="text-sm text-red-700">
      {state.message}
    </p>
  ) : null;
}

export function RevisionForm({ orderId, sisa }: { orderId: string; sisa: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestRevision.bind(null, orderId), {});
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="permintaan" className="label">
        Minta revisi {sisa > 0 ? `(sisa ${sisa} gratis)` : "(di luar kuota, ditagih terpisah)"}
      </label>
      <textarea id="permintaan" name="permintaan" rows={3} required minLength={10} className="field" placeholder="Bagian mana yang perlu diubah dan seperti apa?" />
      <Message state={state} />
      <button type="submit" disabled={pending} className="btn-ghost">
        Kirim permintaan revisi
      </button>
    </form>
  );
}

export function QuoteForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendQuote.bind(null, orderId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="total" className="label">
            Total (Rp)
          </label>
          <input id="total" name="total" type="number" min={10000} step={1000} required className="field" />
        </div>
        <div>
          <label htmlFor="revisi_kuota" className="label">
            Kuota revisi
          </label>
          <input id="revisi_kuota" name="revisi_kuota" type="number" min={0} max={10} defaultValue={2} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="milestones" className="label">
          Milestone (satu per baris)
        </label>
        <textarea id="milestones" name="milestones" rows={4} required className="field" placeholder={"Desain halaman\nFrontend\nIntegrasi dan deploy"} />
      </div>
      <div>
        <label htmlFor="catatan" className="label">
          Catatan untuk klien
        </label>
        <textarea id="catatan" name="catatan" rows={2} className="field" />
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        Kirim penawaran
      </button>
    </form>
  );
}

export function ProgressForm({ orderId, milestones }: { orderId: string; milestones: { id: string; judul: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(postProgress.bind(null, orderId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <div>
          <label htmlFor="milestone_id" className="label">
            Milestone
          </label>
          <select id="milestone_id" name="milestone_id" className="field">
            <option value="">Umum</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.judul}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="persen" className="label">
            Persen
          </label>
          <input id="persen" name="persen" type="number" min={0} max={100} step={5} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="catatan-progres" className="label">
          Catatan progres
        </label>
        <textarea id="catatan-progres" name="catatan" rows={2} required className="field" />
      </div>
      <div>
        <label htmlFor="preview_url" className="label">
          Link preview (opsional)
        </label>
        <input id="preview_url" name="preview_url" type="url" className="field" placeholder="https://" />
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        Simpan progres
      </button>
    </form>
  );
}
