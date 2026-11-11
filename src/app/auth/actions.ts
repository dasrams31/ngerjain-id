"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type FormState = { ok?: boolean; message?: string };

export async function signInWithEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { message: "Alamat email tidak valid." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${site()}/auth/callback?next=/dashboard` },
  });
  if (error) return { message: "Gagal mengirim link. Coba lagi sebentar lagi." };
  return { ok: true, message: "Link masuk sudah dikirim. Cek inbox email kamu." };
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${site()}/auth/callback?next=/dashboard` },
  });
  if (error || !data.url) redirect("/masuk?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
