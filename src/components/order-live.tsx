"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Re-renders the order page when its status, milestones, progress, or payments
 * change, so the client sees updates without reloading.
 */
export function OrderLive({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const filter = `order_id=eq.${orderId}`;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones", filter }, () => router.refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "progress_updates", filter }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  return null;
}
