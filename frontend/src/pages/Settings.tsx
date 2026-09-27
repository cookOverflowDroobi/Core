import { useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, LogOut, Monitor, Moon, Palette, Settings as SettingsIcon, Sun, UserRound } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLogout } from "@/components/layout/useLogout";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, inputClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";
import { api, ApiError, errorMessage } from "@/lib/api";
import { keys, useCurrentUser } from "@/lib/queries";
import { setTheme, themeStore, type ThemePreference } from "@/lib/theme";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./auth/PasswordInput";

function Section({ icon: Icon, title, description, children }: { icon: typeof Sun; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`section-${title}`}>
      <h2 id={`section-${title}`} className="flex items-center gap-2 font-display text-lg font-semibold">
        <Icon className="size-5 text-brand" aria-hidden /> {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function ProfileForm() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: me.first_name, last_name: me.last_name, about: me.about, city: me.city,
    country: me.country, phone: me.phone ?? "", gender: me.gender || "male",
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const avatarUrl = useObjectUrl(avatar);
  const coverUrl = useObjectUrl(cover);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.set(key, value));
    if (avatar) data.set("avatar", avatar);
    if (cover) data.set("cover", cover);
    try {
      const profile = await api<Profile>("/users/me/", { method: "PATCH", form: data });
      qc.setQueryData(keys.me, profile);
      qc.setQueryData(keys.user(profile.username), profile);
      qc.invalidateQueries({ queryKey: ["posts"] });
      setAvatar(null);
      setCover(null);
      toast.success("Profile saved");
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const hasCover = coverUrl || (me.cover && !me.cover.endsWith("/cover.png"));
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line">
        <label className="group relative block h-32 cursor-pointer bg-linear-to-br from-[#f26b1d] via-[#c8410e] to-[#6b2a0e]">
          {hasCover && <img src={coverUrl ?? me.cover!} alt="" className="size-full object-cover" />}
          <span className="absolute inset-0 grid place-items-center bg-black/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-within:bg-black/40 group-focus-within:opacity-100">
            <span className="inline-flex items-center gap-2"><Camera className="size-5" aria-hidden /> Change cover</span>
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setCover(e.target.files?.[0] ?? null)} aria-label="Upload cover photo" />
        </label>
        <div className="flex items-center gap-4 px-4 pb-4">
          <label className="group relative -mt-8 cursor-pointer rounded-full ring-4 ring-surface">
            <Avatar user={{ ...me, avatar: avatarUrl ?? me.avatar }} size="lg" className="size-20" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <Camera className="size-5" aria-hidden />
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} aria-label="Upload profile photo" />
          </label>
          <p className="pt-2 text-xs text-ink-3">Click the photos to change them. JPG or PNG, up to 10 MB.</p>
        </div>
      </div>
      {(errors.avatar || errors.cover) && <p className="text-xs font-medium text-danger">{errors.avatar || errors.cover}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.first_name}>
          {(p) => <Input {...p} value={form.first_name} onChange={set("first_name")} autoComplete="given-name" />}
        </Field>
        <Field label="Last name" error={errors.last_name}>
          {(p) => <Input {...p} value={form.last_name} onChange={set("last_name")} autoComplete="family-name" />}
        </Field>
      </div>
      <Field label="Bio" error={errors.about} hint={`${form.about.length}/500`}>
        {(p) => <Textarea {...p} value={form.about} onChange={set("about")} maxLength={500} rows={3} placeholder="What do you love to cook?" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" error={errors.city} optional>
          {(p) => <Input {...p} value={form.city} onChange={set("city")} maxLength={20} autoComplete="address-level2" />}
        </Field>
        <Field label="Country" error={errors.country} optional>
          {(p) => <Input {...p} value={form.country} onChange={set("country")} maxLength={20} autoComplete="country-name" />}
        </Field>
        <Field label="Gender" error={errors.gender}>
          {(p) => (
            <select {...p} value={form.gender} onChange={set("gender")} className={inputClass}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          )}
        </Field>
      </div>
      <Field label="Phone" error={errors.phone} optional hint="Only you can see this.">
        {(p) => <Input {...p} value={form.phone} onChange={set("phone")} maxLength={20} type="tel" autoComplete="tel" />}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save profile</Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api("/auth/password-change/", { method: "POST", body: { current_password: current, new_password: next } });
      setCurrent("");
      setNext("");
      toast.success("Password changed");
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Current password" error={errors.current_password}>
        {(p) => <PasswordInput {...p} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />}
      </Field>
      <Field label="New password" error={errors.new_password}>
        {(p) => <PasswordInput {...p} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />}
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" variant="outline" loading={saving} disabled={!current || !next}>
          Change password
        </Button>
      </div>
    </form>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function Settings() {
  useDocumentTitle("Settings");
  const me = useCurrentUser();
  const theme = themeStore.use();
  const logout = useLogout();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" icon={SettingsIcon} description={`Signed in as @${me.username}${me.email ? ` · ${me.email}` : ""}`} />
      <Section icon={UserRound} title="Profile" description="How other cooks see you.">
        <ProfileForm />
      </Section>
      <Section icon={Palette} title="Appearance">
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-sm font-semibold transition-colors",
                theme === value ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:border-ink-3",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section icon={KeyRound} title="Password">
        <PasswordForm />
      </Section>
      <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Sign out</h2>
          <p className="text-sm text-ink-3">You can sign back in any time.</p>
        </div>
        <Button variant="outline" onClick={logout} className="text-danger">
          <LogOut className="size-4" aria-hidden /> Sign out
        </Button>
      </section>
    </div>
  );
}
