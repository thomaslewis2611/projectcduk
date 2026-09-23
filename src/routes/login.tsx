import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: "/reports" });
  };

  return (
    <div className="page py-20">
      <div className="max-w-sm mx-auto card p-8">
        <p className="eyebrow">Admin</p>
        <h1 className="display text-3xl mt-1 mb-2">Sign in</h1>
        <p className="text-sm text-muted mb-6">Only the site admin can manage reports.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
