import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";

export type Viewer = {
  id: string;
  email: string;
  nama: string;
  role: "client" | "admin" | "worker";
};

/** Reads the signed-in user. Call inside a <Suspense> boundary (it reads cookies). */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nama, role")
    .eq("id", data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    nama: profile?.nama ?? "",
    role: profile?.role ?? "client",
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/masuk");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") throw new Error("Hanya admin");
  return viewer;
}
