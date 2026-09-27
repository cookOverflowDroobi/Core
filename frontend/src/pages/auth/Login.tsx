import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, ApiError, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { AuthLayout } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export default function Login() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const verified = params.get("verified");

  const signIn = async (event?: FormEvent, credentials = { username, password }) => {
    event?.preventDefault();
    setPending(true);
    setError("");
    try {
      const user = await api<Profile>("/auth/login/", { method: "POST", body: credentials });
      qc.setQueryData(keys.me, user); // <PublicOnly> then redirects to ?next or home
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? err.message : errorMessage(err));
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New here?{" "}
          <Link to={`/register${params.toString() ? `?${params}` : ""}`} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {verified === "1" && <Alert tone="success">Your email is verified. Sign in to start cooking.</Alert>}
      {verified === "0" && <Alert tone="error">That activation link is invalid or has expired.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={signIn} className="space-y-4" noValidate>
        <Field label="Username or email">
          {(props) => (
            <Input {...props} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          )}
        </Field>
        <Field label="Password">
          {(props) => (
            <PasswordInput {...props} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-ink-2 hover:text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!username || !password}>
          Sign in
        </Button>
      </form>

      {isLocal && (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-brand" aria-hidden /> Just exploring?
          </p>
          <p className="mt-1 text-sm text-ink-2">Sign in as Lina, one of the demo cooks.</p>
          <Button
            variant="soft"
            size="sm"
            className="mt-3"
            onClick={() => signIn(undefined, { username: "lina_haddad", password: "cookdemo123" })}
          >
            Use demo account
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
