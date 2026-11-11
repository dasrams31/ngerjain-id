"use client";

import { useActionState } from "react";
import { signInWithEmail, signInWithGoogle, type FormState } from "../auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signInWithEmail, {});

  return (
    <div className="mt-8 space-y-6">
      <form action={signInWithGoogle}>
        <button type="submit" className="btn-ghost w-full py-3">
          Lanjut dengan Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> atau <span className="h-px flex-1 bg-line" />
      </div>

      <form action={action} className="space-y-3">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" placeholder="nama@email.com" />
        <button type="submit" disabled={pending} className="btn-primary w-full py-3">
          {pending ? "Mengirim..." : "Kirim link masuk"}
        </button>
        {state.message && (
          <p role="status" className={`text-sm ${state.ok ? "text-ink" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
