import { useQuery } from "@tanstack/react-query";
import type { Payment } from "@sprintaiso/api-types";
import { fetchPayments } from "../api/endpoints";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatDate, formatSek } from "../lib/format";

export function PaymentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payments"],
    queryFn: fetchPayments,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  const list = data?.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Utbetalningar</h1>

      {list.length === 0 ? (
        <p className="text-sm text-forest-900/60">Inga utbetalningar ännu.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((p: Payment) => (
            <li key={p.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{formatSek(p.amountSek)}</p>
                    <p className="text-xs text-forest-900/60">
                      {formatDate(p.paymentDate)} · {p.bankAccountMasked}
                    </p>
                    {p.deal && (
                      <p className="mt-0.5 truncate text-xs text-forest-900/60">
                        {p.deal.externalId} — {p.deal.title}
                      </p>
                    )}
                    {p.reference && (
                      <p className="mt-1 text-xs text-forest-900/70">
                        Ref: {p.reference}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
