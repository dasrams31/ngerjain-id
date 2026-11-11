import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ngerjain.id: jasa web, machine learning, dan mentoring", template: "%s | ngerjain.id" },
  description:
    "Pesan pembuatan web, olah data dan machine learning, atau mentoring riset. Progres bisa dipantau, chat langsung, bayar bertahap lewat QRIS dan VA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/85 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="text-lg font-bold tracking-tight">
              ngerjain<span className="text-accent">.id</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link href="/#layanan" className="rounded-full px-3 py-1.5 text-muted hover:text-ink">
                Layanan
              </Link>
              <Link href="/#cara-kerja" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-ink sm:inline">
                Cara kerja
              </Link>
              <Link href="/dashboard" className="btn-primary ml-2 py-1.5">
                Dashboard
              </Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line/70 py-8 text-center text-xs text-muted">
          ngerjain.id: jasa pembuatan web, olah data, dan mentoring. Kami tidak menerima pengerjaan tugas atau ujian
          atas nama klien.
        </footer>
      </body>
    </html>
  );
}
