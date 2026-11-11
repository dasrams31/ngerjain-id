"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useState, useTransition } from "react";
import { startPayment } from "@/app/order/actions";

type PoketoCheckout = {
  checkout: {
    open: (
      url: string,
      handlers: { onPaid?: () => void; onClose?: () => void; onStatus?: (s: string) => void },
    ) => void;
  };
};

declare global {
  interface Window {
    Poketo?: PoketoCheckout;
  }
}

/** Opens Poketo's checkout pop-up. The order only moves once the webhook confirms payment. */
export function PayButton({ paymentId, label }: { paymentId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const pay = () =>
    startTransition(async () => {
      setNote(null);
      const res = await startPayment(paymentId);
      if (!res.url) {
        setNote(res.error ?? "Gagal membuat tagihan.");
        return;
      }
      if (!window.Poketo) {
        window.location.href = res.url; // script blocked or not loaded: use the hosted page
        return;
      }
      window.Poketo.checkout.open(res.url, {
        onPaid: () => {
          setNote("Pembayaran diterima, menunggu konfirmasi...");
          router.refresh();
        },
        onClose: () => router.refresh(),
      });
    });

  return (
    <>
      <Script src="https://poketo.id/js/checkout.js" strategy="lazyOnload" />
      <button type="button" onClick={pay} disabled={pending} className="btn-accent">
        {pending ? "Menyiapkan..." : label}
      </button>
      {note && (
        <p role="status" className="mt-2 text-sm text-muted">
          {note}
        </p>
      )}
    </>
  );
}
