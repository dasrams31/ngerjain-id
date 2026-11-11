const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const tanggal = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export const formatRupiah = (n: number) => rupiah.format(n);
export const formatTanggal = (iso: string) => tanggal.format(new Date(iso));
