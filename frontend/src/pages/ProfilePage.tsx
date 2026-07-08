import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerProfile } from "@sprintaiso/api-types";
import {
  fetchMe,
  updateBankAccount,
  updateProfile,
} from "../api/endpoints";
import { Button } from "../components/Button";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDate } from "../lib/format";

export function ProfilePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  if (me.isLoading) return <LoadingSpinner />;
  if (me.error) return <ErrorMessage error={me.error} />;
  if (!me.data) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Profil</h1>
      <ProfileForm profile={me.data} />
      <BankAccountSection profile={me.data} />
    </div>
  );
}

function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: profile.user.name,
    email: profile.user.email,
    phone: profile.phone ?? "",
    addressStreet: profile.address.street ?? "",
    addressPostal: profile.address.postal ?? "",
    addressCity: profile.address.city ?? "",
  });
  const [saved, setSaved] = useState(false);

  function updateField(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  }

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      name: form.name,
      email: form.email,
      phone: form.phone,
      addressStreet: form.addressStreet,
      addressPostal: form.addressPostal,
      addressCity: form.addressCity,
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-forest-200 bg-white p-4"
    >
      <h2 className="text-lg">Personuppgifter</h2>

      <Field
        label="Namn"
        value={form.name}
        onChange={(v) => updateField({ name: v })}
      />
      <Field
        label="E-post"
        type="email"
        value={form.email}
        onChange={(v) => updateField({ email: v })}
      />
      <Field
        label="Telefon"
        type="tel"
        value={form.phone}
        onChange={(v) => updateField({ phone: v })}
      />
      <Field
        label="Gatuadress"
        value={form.addressStreet}
        onChange={(v) => updateField({ addressStreet: v })}
      />
      <div className="flex gap-3">
        <div className="w-1/3">
          <Field
            label="Postnummer"
            value={form.addressPostal}
            onChange={(v) => updateField({ addressPostal: v })}
          />
        </div>
        <div className="flex-1">
          <Field
            label="Ort"
            value={form.addressCity}
            onChange={(v) => updateField({ addressCity: v })}
          />
        </div>
      </div>

      {save.error && <ErrorMessage error={save.error} />}
      {saved && !save.isPending && (
        <p className="rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 text-sm text-forest-700">
          Sparat.
        </p>
      )}

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Sparar..." : "Spara"}
      </Button>
    </form>
  );
}

function BankAccountSection({ profile }: { profile: CustomerProfile }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: updateBankAccount,
    onSuccess: () => {
      setEditing(false);
      setValue("");
      setConfirmed(false);
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed || !value.trim()) return;
    mutation.mutate({ bankAccount: value.trim() });
  }

  return (
    <section className="space-y-3 rounded-xl border border-forest-200 bg-white p-4">
      <h2 className="text-lg">Bankkonto</h2>
      <p className="text-sm text-forest-900/80">
        Aktuellt kontonummer: <strong>{profile.bankAccountMasked ?? "—"}</strong>
        {profile.bankAccountUpdatedAt && (
          <>
            {" "}
            (uppdaterat {formatDate(profile.bankAccountUpdatedAt)})
          </>
        )}
      </p>

      {!editing && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Byt kontonummer
        </Button>
      )}

      {editing && (
        <form onSubmit={submit} className="space-y-3">
          <div
            role="alert"
            className="rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-2 text-sm text-[color:var(--gold)]"
            style={{ color: "var(--gold)" }}
          >
            <strong>Viktigt:</strong> kontonummerbyte loggas alltid med IP-adress
            och tidpunkt i vår revisionslogg.
          </div>

          <Field
            label="Nytt kontonummer"
            placeholder="t.ex. 3300-1234567"
            value={value}
            onChange={setValue}
          />

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Jag bekräftar att det nya kontonumret är korrekt och att ändringen
              loggas.
            </span>
          </label>

          {mutation.error && <ErrorMessage error={mutation.error} />}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!confirmed || !value.trim() || mutation.isPending}
            >
              {mutation.isPending ? "Sparar..." : "Bekräfta ändring"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue("");
                setConfirmed(false);
              }}
            >
              Avbryt
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
      />
    </label>
  );
}
