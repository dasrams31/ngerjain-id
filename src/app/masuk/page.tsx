import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function MasukPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Masuk</h1>
      <p className="mt-2 text-muted">Pakai Google atau link yang dikirim ke email. Tidak perlu password.</p>
      <LoginForm />
    </main>
  );
}
