import { useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { api, ApiError, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { AuthLayout, StrengthMeter } from "./AuthLayout";
import { PasswordInput } from "./PasswordInput";

type RegisterResponse = { verification_required: true; email: string } | { verification_required: false; user: Profile };

export default function Register() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await api<RegisterResponse>("/auth/register/", { method: "POST", body: form });
      if (result.verification_required) {
        setSentTo(result.email);
        setPending(false);
      } else {
        qc.setQueryData(keys.me, result.user);
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setError(errorMessage(err));
      setPending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox">
        <EmptyState icon={MailCheck} title="One more step" action={<ButtonLink to="/login">Back to sign in</ButtonLink>} className="px-0">
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account.
        </EmptyState>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join the kitchen"
      subtitle={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.first_name}>
            {(props) => <Input {...props} value={form.first_name} onChange={update("first_name")} autoComplete="given-name" autoFocus />}
          </Field>
          <Field label="Last name" error={errors.last_name}>
            {(props) => <Input {...props} value={form.last_name} onChange={update("last_name")} autoComplete="family-name" />}
          </Field>
        </div>
        <Field label="Username" error={errors.username} hint="3–30 letters, numbers, dots or underscores.">
          {(props) => (
            <Input
              {...props}
              value={form.username}
              onChange={update("username")}
              autoComplete="username"
              pattern="[A-Za-z0-9_.]{3,30}"
              required
            />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => <Input {...props} type="email" value={form.email} onChange={update("email")} autoComplete="email" required />}
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters. Mix it up.">
          {(props) => (
            <PasswordInput {...props} value={form.password} onChange={update("password")} autoComplete="new-password" required />
          )}
        </Field>
        <StrengthMeter password={form.password} />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!form.username || !form.email || !form.password}
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
