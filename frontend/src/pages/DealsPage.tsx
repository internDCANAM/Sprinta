import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { DealSummary } from "@sprintaiso/api-types";
import { fetchDeals } from "../api/endpoints";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatSek } from "../lib/format";

const ONGOING = new Set(["PLANNED", "ONGOING", "COMPLETED", "INVOICED"]);

export function DealsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["deals"],
    queryFn: () => fetchDeals(1, 100),
  });

  const grouped = useMemo(() => {
    const deals = data?.data ?? [];
    const ongoing: DealSummary[] = [];
    const finished: DealSummary[] = [];
    let totalEstimated = 0;
    for (const d of deals) {
      if (ONGOING.has(d.status)) {
        ongoing.push(d);
        totalEstimated += Number(d.estimatedGrossSek ?? 0);
      } else {
        finished.push(d);
      }
    }
    return { ongoing, finished, totalEstimated };
  }, [data]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="space-y-6">
      <section
        className="rounded-xl p-5 text-white shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, var(--green-700), var(--green-500))",
        }}
      >
        <p className="text-sm opacity-90">Preliminär ersättning</p>
        <p className="font-display text-3xl">{formatSek(grouped.totalEstimated)}</p>
        <p className="mt-2 text-sm opacity-90">
          {grouped.ongoing.length} aktiv{grouped.ongoing.length === 1 ? "" : "a"}{" "}
          affär{grouped.ongoing.length === 1 ? "" : "er"}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg">Pågående</h2>
        {grouped.ongoing.length === 0 ? (
         // <p className="text-sm text-forest-900/60">Inga pågående affärer.</p>
            <Card>
              <div className="py-6 text-center">
                <p className="font-medium text-forest-900">Inga pågående affärer</p>
                <p className="mt-2 text-sm text-forest-900/60">
                  Dina aktiva affärer visas här när de finns.
                </p>
              </div>
            </Card>
        ) : (
          <ul className="space-y-3">
            {grouped.ongoing.map((d) => (
              <li key={d.id}>
                <DealCard deal={d} onClick={() => navigate(`/deals/${d.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg">Avslutade</h2>
        {grouped.finished.length === 0 ? (
         // <p className="text-sm text-forest-900/60">Inga avslutade affärer.</p>
            <Card>
              <div className="py-6 text-center">
                <p className="font-medium text-forest-900">Inga avslutade affärer</p>
                <p className="mt-2 text-sm text-forest-900/60">
                  Avslutade affärer visas här när de finns.
                </p>
              </div>
            </Card>
        ) : (
          <ul className="space-y-3">
            {grouped.finished.map((d) => (
              <li key={d.id}>
                <DealCard deal={d} onClick={() => navigate(`/deals/${d.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DealCard({
  deal,
  onClick,
}: {
  deal: DealSummary;
  onClick: () => void;
}) {
  const amount = deal.finalGrossSek ?? deal.estimatedGrossSek;
  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-forest-900">{deal.title}</p>
          <p className="text-xs text-forest-900/60">
            {deal.externalId}
            {deal.property?.name ? ` · ${deal.property.name}` : ""}
          </p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs text-forest-900/60">
          {deal.finalGrossSek ? "Slutlikvid" : "Preliminärt"}
        </span>
        <span className="font-display text-lg text-forest-900">
          {formatSek(amount)}
        </span>
      </div>
    </Card>
  );
}
