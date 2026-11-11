const LABEL: Record<string, string> = {
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

const TONE: Record<string, string> = {
  awaiting_dp: "bg-accent/15 text-ink",
  awaiting_final: "bg-accent/15 text-ink",
  quoted: "bg-accent/15 text-ink",
  completed: "bg-ink text-paper",
  cancelled: "bg-line text-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status] ?? "bg-line/70 text-ink"}`}>
      {LABEL[status] ?? status}
    </span>
  );
}
