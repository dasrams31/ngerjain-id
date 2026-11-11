# ngerjain.id

Platform pemesanan jasa web, machine learning / olah data, dan mentoring: brief, penawaran, pembayaran bertahap lewat Poketo, progres milestone, dan chat realtime.

Stack: Next.js 16 (App Router, Cache Components), React Three Fiber, Tailwind CSS v4, Supabase (Postgres, Auth, Realtime, Storage), Poketo.

## Menjalankan di lokal

1. Install dependensi:

   ```bash
   pnpm install
   ```

2. Buat project di [Supabase](https://supabase.com) (region Singapura), lalu jalankan migrasi di `supabase/migrations/` lewat SQL Editor atau:

   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push
   ```

3. Salin `.env.example` ke `.env.local` dan isi semua nilainya. Pakai key `sk_test_` dari Poketo selama development.

4. Di Supabase Auth, aktifkan provider Email (magic link) dan Google, lalu tambahkan `http://localhost:3000/auth/callback` ke Redirect URLs.

5. Jalankan:

   ```bash
   pnpm dev
   ```

6. Masuk sekali, lalu jadikan akunmu admin lewat SQL Editor:

   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'email-kamu@contoh.com');
   ```

## Alur pembayaran

- Klien menerima penawaran: server membuat baris `payments` (DP 50% untuk order di atas Rp 1.000.000, selain itu bayar penuh).
- Tombol "Bayar sekarang" membuat invoice Poketo (`referenceId` = id payment, `Idempotency-Key` = `payment-<id>`) dan membuka checkout pop-up.
- Status lunas **hanya** diubah oleh `POST /api/webhooks/poketo`: tanda tangan diverifikasi, event di-dedupe lewat tabel `webhook_events`.
- `GET /api/cron/check-invoices` (header `Authorization: Bearer $CRON_SECRET`) memeriksa ulang invoice pending yang lebih dari 30 menit. Jadwalkan tiap 15 menit. Vercel Hobby hanya mengizinkan cron sekali sehari, jadi pakai Supabase `pg_cron` + `pg_net`, cron eksternal, atau Vercel Pro.

### Menguji webhook di lokal

Poketo perlu URL publik. Pakai tunnel (misalnya `cloudflared tunnel --url http://localhost:3000`), daftarkan `https://<tunnel>/api/webhooks/poketo` di dashboard Poketo, lalu salin secret `whsec_` ke `.env.local`. Admin bisa menekan "Simulasi lunas (sandbox)" di halaman order untuk memicu `invoice.paid` tanpa uang sungguhan.

## Catatan

- Paket `poketo-node` yang disebut di dokumentasi Poketo belum ada di npm, jadi `src/lib/poketo.ts` memanggil REST API langsung. Bentuk respons (objek langsung atau `{ data }`) ditangani dua-duanya. Cek ulang dengan key sandbox.
- Belum dibuat: upload lampiran (tabel `attachments` dan bucket `order-files` sudah ada), notifikasi email, kuitansi PDF, kalkulator estimasi, dan fitur fase 2 di PRD.
