import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../components/Button";
import { extractErrorMessage } from "../api/client";
import { useToast } from "../components/ToastProvider";

export function LoginPage() {
  const { showToast } = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      showToast("Login successful", "success");
      const from = (location.state as { from?: string } | null)?.from;
      const defaultHome = user.role === "CUSTOMER" ? "/deals" : "/admin";
      navigate(from ?? defaultHome, { replace: true });
    } catch (e) {
     // setErr(extractErrorMessage(e));
      const message = extractErrorMessage(e);
      setErr(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-mobile flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div
          aria-hidden
          className="mx-auto mb-3 h-14 w-14 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, var(--green-700), var(--green-500))",
          }}
        />
        <h1 className="font-display text-2xl text-forest-900">Sprintaiso</h1>
        <p className="mt-1 text-sm text-forest-900/70">
          Logga in för att se dina affärer
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-forest-200 bg-white p-5 shadow-sm"
        noValidate
      >
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">E-post</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Lösenord</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
          />
        </label>

        {err && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {err}
          </div>
        )}

        <Button type="submit" block disabled={submitting}>
          {submitting ? "Loggar in..." : "Logga in"}
        </Button>
      </form>
    </div>
  );
}
