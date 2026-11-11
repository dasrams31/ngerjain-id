import Link from "next/link";
import { Hero3D } from "@/components/hero-3d";
import { formatRupiah } from "@/lib/format";

// Display copy of the catalog seeded in supabase/migrations. Kept static so the
// landing page prerenders without a database call.
const LAYANAN = [
  { kategori: "Web", nama: "Landing page / company profile", harga: 750_000, unit: "", isi: "1-5 halaman, responsif, siap SEO, revisi 2x." },
  { kategori: "Web", nama: "Web app custom", harga: 3_000_000, unit: "", isi: "Dashboard atau sistem informasi, dibayar per milestone." },
  { kategori: "ML & data", nama: "Olah data dan visualisasi", harga: 500_000, unit: "", isi: "Bersihkan data, analisis, dan dashboard yang mudah dibaca." },
  { kategori: "ML & data", nama: "Training dan evaluasi model", harga: 1_500_000, unit: "", isi: "Eksperimen yang rapi, terdokumentasi, bisa direproduksi." },
  { kategori: "Mentoring", nama: "Sesi mentoring coding / riset", harga: 100_000, unit: "/sesi", isi: "60 menit bareng mentor. Kamu tetap yang mengerjakan." },
  { kategori: "Review", nama: "Review dan proofreading", harga: 150_000, unit: "", isi: "Struktur, grammar, dan format sitasi dicek satu per satu." },
];

const LANGKAH = [
  { judul: "Kirim brief", isi: "Pilih layanan, ceritakan kebutuhan, lampirkan file. Gratis dan tanpa komitmen." },
  { judul: "Terima penawaran", isi: "Harga pasti, milestone, deadline, dan jumlah revisi. Mau nego? Tinggal chat." },
  { judul: "Bayar DP", isi: "QRIS, virtual account, PayLater, atau kartu debit. Order di atas Rp 1 juta cukup DP 50%." },
  { judul: "Pantau progres", isi: "Setiap milestone dan preview muncul langsung di halaman order kamu." },
  { judul: "Review dan lunasi", isi: "Revisi sesuai kuota, lalu lunasi. File final dan repo langsung terbuka." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pt-12 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <p className="mb-4 inline-block rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
            Web · Machine learning · Mentoring riset
          </p>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Project kamu, <span className="text-accent">dikerjain</span> sampai beres.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Kirim brief, terima harga pasti, lalu pantau setiap milestone dan chat langsung dengan yang mengerjakan.
            Bayar bertahap lewat QRIS atau VA.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/order/baru" className="btn-accent px-6 py-3 text-base">
              Kirim brief gratis
            </Link>
            <Link href="#layanan" className="btn-ghost px-6 py-3 text-base">
              Lihat harga
            </Link>
          </div>
        </div>
        <div className="aspect-square w-full max-w-[520px] justify-self-center">
          <Hero3D />
        </div>
      </section>

      <section id="layanan" className="border-t border-line/70 bg-card/60 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold tracking-tight">Layanan dan harga awal</h2>
          <p className="mt-2 max-w-xl text-muted">
            Harga final selalu lewat penawaran setelah brief dibaca. Biaya pembayaran ditanggung pembeli sesuai metode.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LAYANAN.map((l) => (
              <li key={l.nama} className="panel flex flex-col">
                <span className="text-xs font-semibold tracking-wide text-accent uppercase">{l.kategori}</span>
                <h3 className="mt-2 text-lg font-semibold">{l.nama}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{l.isi}</p>
                <p className="mt-4 text-sm">
                  mulai <span className="text-xl font-bold">{formatRupiah(l.harga)}</span>
                  {l.unit}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="cara-kerja" className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold tracking-tight">Cara kerja</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-5">
            {LANGKAH.map((s, i) => (
              <li key={s.judul} className="border-t-2 border-ink pt-4">
                <span className="font-mono text-sm text-muted">0{i + 1}</span>
                <h3 className="mt-1 font-semibold">{s.judul}</h3>
                <p className="mt-1 text-sm text-muted">{s.isi}</p>
              </li>
            ))}
          </ol>
          <div className="panel mt-12 flex flex-col items-start justify-between gap-4 bg-ink text-paper sm:flex-row sm:items-center">
            <p className="text-lg font-semibold">Punya project yang mau dikerjain? Brief pertama gratis dibaca.</p>
            <Link href="/order/baru" className="btn-accent">
              Mulai sekarang
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
