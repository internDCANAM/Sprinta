import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminDeal,
  fetchAdminCustomers,
  fetchAdminDeals,
  fetchDomainConfig,
} from "../api/endpoints";
import type { DealType } from "@sprintaiso/api-types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatSek } from "../lib/format";

export function AdminPage() {
  const [showCreate, setShowCreate] = useState(false);

  const customers = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: fetchAdminCustomers,
  });
  const deals = useQuery({
    queryKey: ["admin", "deals"],
    queryFn: fetchAdminDeals,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Admin</h1>
        <Button onClick={() => setShowCreate(true)}>+ Skapa affär</Button>
      </div>

      <IntegrationStatus />

      <section>
        <h2 className="mb-2 text-lg">Kunder</h2>
        {customers.isLoading ? (
          <LoadingSpinner />
        ) : customers.error ? (
          <ErrorMessage error={customers.error} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-forest-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-900/70">
                <tr>
                  <th className="px-3 py-2">Namn</th>
                  <th className="px-3 py-2">E-post</th>
                  <th className="px-3 py-2 text-right">Affärer</th>
                </tr>
              </thead>
              <tbody>
                {customers.data!.data.map((c) => (
                  <tr key={c.id} className="border-t border-forest-200">
                    <td className="px-3 py-2">{c.user.name}</td>
                    <td className="px-3 py-2 text-forest-900/70">
                      {c.user.email}
                    </td>
                    <td className="px-3 py-2 text-right">{c._count.deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg">Affärer</h2>
        {deals.isLoading ? (
          <LoadingSpinner />
        ) : deals.error ? (
          <ErrorMessage error={deals.error} />
        ) : (
          <ul className="space-y-3">
            {deals.data!.data.map((d) => (
              <li key={d.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-forest-900/60">
                        {d.externalId} · {d.customer.user.name}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-2 text-sm text-forest-900/70">
                    Preliminärt: {formatSek(d.estimatedGrossSek)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <CreateDealModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function IntegrationStatus() {
  return (
    <div className="rounded-xl border border-forest-200 bg-white p-4">
      <h2 className="mb-3 text-lg">Integrationer</h2>
      <ul className="space-y-2 text-sm">
        <StatusRow label="VSYS (skogsägarsystem)" ok note="Senast: 12 min sedan" />
        <StatusRow label="SDC / VMF mätdata" ok note="Senast: 4 tim sedan" />
        <StatusRow label="Bank (SEB)" ok note="Senast: i natt kl 02:00" />
        <StatusRow label="BankID signering" ok note="Aktiv" />
      </ul>
      <p className="mt-3 text-xs text-forest-900/50">
        (Mockad data — kopplas upp i senare session.)
      </p>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  note,
}: {
  label: string;
  ok: boolean;
  note?: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${ok ? "bg-forest-500" : "bg-red-500"}`}
        />
        <span className="text-forest-900/60">{note}</span>
      </span>
    </li>
  );
}

function CreateDealModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const customers = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: fetchAdminCustomers,
  });
  const config = useQuery({
    queryKey: ["config"],
    queryFn: fetchDomainConfig,
  });

  const [customerId, setCustomerId] = useState("");
  const [externalId, setExternalId] = useState("");
  const [title, setTitle] = useState("");
  const [dealType, setDealType] = useState<DealType>("REGENERATION_FELLING");
  const [estimated, setEstimated] = useState("");

  const create = useMutation({
    mutationFn: createAdminDeal,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "deals"] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!customerId || !externalId || !title) return;
    create.mutate({
      customerId,
      externalId,
      title,
      dealType,
      estimatedGrossSek: estimated ? Number(estimated) : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-6 pt-20 sm:items-center">
      <div className="w-full max-w-mobile rounded-xl bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg">Skapa ny affär</h3>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="rounded-md px-2 py-1 text-forest-700 hover:bg-forest-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Kund</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            >
              <option value="">Välj kund...</option>
              {customers.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.name} ({c.user.email})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">External ID</span>
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              required
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Titel</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Typ</span>
            <select
              value={dealType}
              onChange={(e) => setDealType(e.target.value as DealType)}
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            >
              {(config.data?.dealTypes ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Preliminärt brutto (SEK)</span>
            <input
              type="number"
              min={0}
              value={estimated}
              onChange={(e) => setEstimated(e.target.value)}
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          {create.error && <ErrorMessage error={create.error} />}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Skapar..." : "Skapa"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Avbryt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
