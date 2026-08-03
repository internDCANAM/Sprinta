import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DealType } from '@sprintaiso/api-types';
import { createAdminDeal, fetchAdminDeals, fetchAdminUsers, fetchDomainConfig } from '../api/endpoints';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge } from '../components/StatusBadge';
import { formatMoney } from '../lib/format';

type AdminUsers = Awaited<ReturnType<typeof fetchAdminUsers>>['data'];
type AdminDeals = Awaited<ReturnType<typeof fetchAdminDeals>>['data'];

export function AdminPage() {
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchAdminUsers });
  const dealsQuery = useQuery({ queryKey: ['admin', 'deals'], queryFn: fetchAdminDeals });

  const owners = (usersQuery.data?.data ?? []).filter((user) => !user.isAdmin);
  const deals = dealsQuery.data?.data ?? [];
  const isPageLoading = usersQuery.isLoading || dealsQuery.isLoading;
  const canCreateDeal = owners.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-forest-950">Administration</h1>
          <p className="mt-1 text-sm text-forest-900/60">
            Hantera kunder, affärer och integrationer.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowCreateDeal(true)}
          disabled={!canCreateDeal || isPageLoading}
        >
          + Skapa affär
        </Button>
      </header>

      {!isPageLoading && (
        <AdminSummary ownerCount={owners.length} dealCount={deals.length} />
      )}

      <IntegrationStatus />

      <OwnersSection
        owners={owners}
        isLoading={usersQuery.isLoading}
        error={usersQuery.error}
        onRetry={() => {
          void usersQuery.refetch();
        }}
      />

      <DealsSection
        deals={deals}
        isLoading={dealsQuery.isLoading}
        error={dealsQuery.error}
        onRetry={() => {
          void dealsQuery.refetch();
        }}
      />

      {showCreateDeal && canCreateDeal && (
        <CreateDealModal onClose={() => setShowCreateDeal(false)} />
      )}
    </div>
  );
}

function AdminSummary({ ownerCount, dealCount }: { ownerCount: number; dealCount: number; }) {
  return (
    <section
      aria-label="Administrationsöversikt"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <Card>
        <p className="text-sm text-forest-900/60">Kunder</p>
        <p className="mt-1 font-display text-3xl text-forest-950">{ownerCount}</p>
      </Card>

      <Card>
        <p className="text-sm text-forest-900/60">Affärer</p>
        <p className="mt-1 font-display text-3xl text-forest-950">{dealCount}</p>
      </Card>
    </section>
  );
}

function OwnersSection({
  owners,
  isLoading,
  error,
  onRetry,
}: {
  owners: AdminUsers;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="owners-heading">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="owners-heading" className="text-lg font-medium text-forest-950">
            Kunder
          </h2>
          <p className="text-sm text-forest-900/60">
            Registrerade kundkonton och deras affärer.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {!isLoading && !error && (
            <span className="text-sm text-forest-900/60">{owners.length} totalt</span>
          )}
          <Button type="button">+ Skapa kund</Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Laddar kunder..." />
      ) : error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : owners.length === 0 ? (
        <EmptyState
          title="Inga kunder ännu"
          description="När en kund skapas visas kunden här tillsammans med sina affärer."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-forest-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-900/70">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-3">Namn</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">E-post</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Affärer</th>
              </tr>
            </thead>

            <tbody>
              {owners.map((owner) => (
                <tr
                  key={owner.id}
                  className="border-t border-forest-200 transition-colors hover:bg-forest-50/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-forest-950">
                    {owner.name}
                  </td>
                  <td className="px-4 py-3 text-forest-900/70">
                    <span className="break-all">{owner.email}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {owner.dealCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DealsSection({
  deals,
  isLoading,
  error,
  onRetry,
}: {
  deals: AdminDeals;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="deals-heading">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="deals-heading" className="text-lg font-medium text-forest-950">Affärer</h2>
          <p className="text-sm text-forest-900/60">Senaste registrerade kundaffärer.</p>
        </div>

        {!isLoading && !error && (
          <span className="text-sm text-forest-900/60">{deals.length} totalt</span>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Laddar affärer..." />
      ) : error ? (
        <QueryError error={error} onRetry={onRetry} />
      ) : deals.length === 0 ? (
        <EmptyState
          title="Inga affärer ännu"
          description="Skapa den första affären genom att använda knappen högst upp."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-forest-950">{deal.title}</p>
                    <p className="mt-1 truncate text-xs text-forest-900/60">
                      {deal.externalId} · {deal.owner.name}
                    </p>
                  </div>
                  <StatusBadge status={deal.status} />
                </div>

                <div className="mt-4 border-t border-forest-100 pt-3">
                  <p className="text-xs text-forest-900/50">Preliminärt brutto</p>
                  <p className="mt-1 font-medium text-forest-950">
                    {formatMoney(deal.estimatedGrossMinor)}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IntegrationStatus() {
  return (
    <section className="rounded-xl border border-forest-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-medium text-forest-950">Integrationer</h2>

      <ul className="space-y-3 text-sm">
        <StatusRow label="VSYS (skogsägarsystem)" ok note="Senast: 12 min sedan" />
        <StatusRow label="SDC / VMF mätdata" ok note="Senast: 4 tim sedan" />
        <StatusRow label="Bank (SEB)" ok note="Senast: i natt kl. 02:00" />
        <StatusRow label="BankID-signering" ok note="Aktiv" />
      </ul>

      <p className="mt-4 text-xs text-forest-900/50">
        Mockad data – kopplas upp i en senare session.
      </p>
    </section>
  );
}

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string; }) {
  return (
    <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${ok ? 'bg-forest-500' : 'bg-red-500'}`}
        />
        <span className="text-forest-900/60">{note}</span>
      </span>
    </li>
  );
}

function CreateDealModal({ onClose }: { onClose: () => void; }) {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchAdminUsers });
  const configQuery = useQuery({ queryKey: ['config'], queryFn: fetchDomainConfig });

  const [ownerId, setOwnerId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [title, setTitle] = useState('');
  const [dealType, setDealType] = useState<DealType>('REGENERATION_FELLING');
  const [estimated, setEstimated] = useState('');

  const createDealMutation = useMutation({
    mutationFn: createAdminDeal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deals'] });
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanExternalId = externalId.trim();
    const cleanTitle = title.trim();
    if (!ownerId || !cleanExternalId || !cleanTitle) return;

    const estimatedGrossSek = estimated.trim() === '' ? undefined : Number(estimated);
    if (
      estimatedGrossSek !== undefined &&
      (!Number.isFinite(estimatedGrossSek) || estimatedGrossSek < 0)
    ) {
      return;
    }

    createDealMutation.mutate({
      ownerId,
      externalId: cleanExternalId,
      title: cleanTitle,
      dealType,
      estimatedGrossMinor:
        estimatedGrossSek === undefined ? undefined : Math.round(estimatedGrossSek * 100),
    });
  }

  const owners = (usersQuery.data?.data ?? []).filter((user) => !user.isAdmin);

  const isFormUnavailable =
    usersQuery.isLoading ||
    configQuery.isLoading ||
    usersQuery.isError ||
    configQuery.isError;

  const isSubmitDisabled =
    createDealMutation.isPending ||
    isFormUnavailable ||
    !ownerId ||
    !externalId.trim() ||
    !title.trim();

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-6 pt-20 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-deal-title"
        className="max-h-[90vh] w-full max-w-mobile overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="create-deal-title" className="font-display text-lg text-forest-950">
            Skapa ny affär
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng dialogrutan"
            className="rounded-md px-2 py-1 text-forest-700 transition-colors hover:bg-forest-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Kund</span>
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              required
              disabled={usersQuery.isLoading || usersQuery.isError}
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{usersQuery.isLoading ? 'Laddar kunder...' : 'Välj kund...'}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.email})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">External ID</span>
            <input
              value={externalId}
              onChange={(event) => setExternalId(event.target.value)}
              required
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Titel</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Typ</span>
            <select
              value={dealType}
              onChange={(event) => setDealType(event.target.value as DealType)}
              disabled={configQuery.isLoading || configQuery.isError}
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(configQuery.data?.dealTypes ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
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
              onChange={(event) => setEstimated(event.target.value)}
              className="w-full rounded-lg border border-forest-200 bg-forest-50 px-3 py-2"
            />
          </label>

          {usersQuery.error && <ErrorMessage error={usersQuery.error} />}
          {configQuery.error && <ErrorMessage error={configQuery.error} />}
          {createDealMutation.error && <ErrorMessage error={createDealMutation.error} />}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button type="submit" disabled={isSubmitDisabled}>
              {createDealMutation.isPending ? 'Skapar...' : 'Skapa affär'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={createDealMutation.isPending}
            >
              Avbryt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string; }) {
  return (
    <div className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 px-6 py-10 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-forest-100"
      >
        <span className="text-lg">＋</span>
      </div>
      <h3 className="font-medium text-forest-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-forest-900/60">{description}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string; }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-32 items-center justify-center rounded-xl border border-forest-200 bg-white"
    >
      <LoadingSpinner />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void; }) {
  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <ErrorMessage error={error} />
      <Button type="button" variant="ghost" onClick={onRetry}>
        Försök igen
      </Button>
    </div>
  );
}
