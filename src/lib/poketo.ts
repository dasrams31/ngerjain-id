import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal Poketo client over the REST API (https://poketo.id/llms.txt).
// The docs mention a `poketo-node` SDK, but it is not on npm yet, so this
// file talks to the API directly.

const BASE_URL = "https://poketo.id/api/v1";

export type PoketoInvoiceStatus = "pending" | "paid" | "expired" | "cancelled" | "refunded";

export type PoketoInvoice = {
  id: string;
  status: PoketoInvoiceStatus;
  amount: number;
  paymentUrl: string;
  referenceId?: string;
  paymentMethod?: string;
};

export type CreateInvoiceInput = {
  amount: number;
  title: string;
  description?: string;
  customer?: { name?: string; email?: string; phone?: string };
  items?: { name: string; quantity: number; price: number }[];
  referenceId: string;
  redirectUrl?: string;
  expiresInMinutes?: number;
  metadata?: Record<string, string>;
};

export class PoketoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.POKETO_SECRET_KEY;
  if (!key) throw new Error("POKETO_SECRET_KEY is not set");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new PoketoError(res.status, err.code ?? "unknown", err.message ?? res.statusText);
  }
  // Accept both a bare object and a { data } envelope.
  return (json?.data ?? json) as T;
}

export function createInvoice(input: CreateInvoiceInput, idempotencyKey: string) {
  return request<PoketoInvoice>("/invoices", {
    method: "POST",
    body: JSON.stringify(input),
    idempotencyKey,
  });
}

export function getInvoice(id: string) {
  return request<PoketoInvoice>(`/invoices/${encodeURIComponent(id)}`);
}

/** Asks the payment provider now and settles the invoice if it was paid. */
export function checkInvoiceStatus(id: string) {
  return request<PoketoInvoice>(`/invoices/${encodeURIComponent(id)}/check-status`, { method: "POST" });
}

/** Sandbox only: mark an invoice paid or expired. */
export function simulateInvoice(id: string, result: "paid" | "expired", paymentMethod = "QRIS") {
  return request<PoketoInvoice>(`/invoices/${encodeURIComponent(id)}/simulate`, {
    method: "POST",
    body: JSON.stringify({ result, paymentMethod }),
  });
}

/**
 * Verifies a `Poketo-Signature: t=<unix>,v1=<hex>` header.
 * v1 = HMAC-SHA256(secret, "<t>.<raw body>"). Rejects signatures older than 5 minutes.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
