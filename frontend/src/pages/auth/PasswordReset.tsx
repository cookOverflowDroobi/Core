import { KeyRound, MailCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { api, ApiError, errorMessage } from "@/lib/api";
import { AuthLayout, StrengthMeter } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ detail: string; dev_reset_url?: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      setResult(await api("/auth/password-reset/", { method: "POST", body: { email } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (result) {
    const devPath = result.dev_reset_url ? new URL(result.dev_reset_url).pathname : null;
    return (
      <AuthLayout title="Check your inbox">
        <EmptyState icon={MailCheck} title="Reset link sent" className="px-0" action={<ButtonLink to="/login" variant="outline">Back to sign in</ButtonLink>}>
          {result.detail}
          {devPath && (
            <span className="mt-4 block rounded-xl bg-brand-soft p-3 text-left text-brand">
              <strong className="block">Local development</strong>
              Emails aren't sent here, so use this link:{" "}
              <Link to={devPath} className="font-semibold underline">
                reset your password
              </Link>
            </span>
          )}
        </EmptyState>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          {(props) => <Input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!email}>
          Send reset link
        </Button>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-ink-2 hover:text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { uid = "", token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api("/auth/password-reset/confirm/", { method: "POST", body: { uid, token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.password ?? err.message) : errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="All set">
        <EmptyState icon={KeyRound} title="Password updated" className="px-0" action={<ButtonLink to="/login">Sign in</ButtonLink>}>
          You can now sign in with your new password.
        </EmptyState>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          {(props) => <PasswordInput {...props} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />}
        </Field>
        <StrengthMeter password={password} />
        <Field label="Confirm password">
          {(props) => <PasswordInput {...props} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!password || !confirm}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
