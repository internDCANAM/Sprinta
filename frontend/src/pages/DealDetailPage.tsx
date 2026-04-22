import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import type {
  DealCost,
  DealEvent,
  DocumentSummary,
  Message,
  TimberPost,
} from "@sprintaiso/shared";
import {
  fetchDeal,
  fetchDealCosts,
  fetchDealDocuments,
  fetchDealEvents,
  fetchDealMessages,
  fetchDealTimber,
  sendDealMessage,
} from "../api/endpoints";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { ErrorMessage } from "../components/ErrorMessage";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatSek,
} from "../lib/format";
import { useAuth } from "../auth/AuthProvider";

type Tab = "overview" | "economy" | "messages" | "documents";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Översikt" },
  { id: "economy", label: "Ekonomi" },
  { id: "messages", label: "Meddelanden" },
  { id: "documents", label: "Dokument" },
];

export function DealDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("overview");

  const deal = useQuery({
    queryKey: ["deal", id],
    queryFn: () => fetchDeal(id),
    enabled: Boolean(id),
  });

  if (deal.isLoading) return <LoadingSpinner />;
  if (deal.error) return <ErrorMessage error={deal.error} />;
  if (!deal.data) return null;

  return (
    <div className="space-y-4">
      <Link to="/deals" className="text-sm text-forest-700 hover:underline">
        ← Tillbaka
      </Link>

      <header className="rounded-xl border border-forest-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl">{deal.data.title}</h1>
            <p className="text-xs text-forest-900/60">
              {deal.data.externalId}
              {deal.data.property?.name ? ` · ${deal.data.property.name}` : ""}
            </p>
          </div>
          <StatusBadge status={deal.data.status} />
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-forest-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm transition",
              tab === t.id
                ? "bg-forest-700 text-white"
                : "text-forest-900/70 hover:bg-forest-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab dealId={id} />}
      {tab === "economy" && <EconomyTab dealId={id} />}
      {tab === "messages" && <MessagesTab dealId={id} />}
      {tab === "documents" && <DocumentsTab dealId={id} />}
    </div>
  );
}

// ------------------------ Tabs ------------------------

function OverviewTab({ dealId }: { dealId: string }) {
  const events = useQuery({
    queryKey: ["deal", dealId, "events"],
    queryFn: () => fetchDealEvents(dealId),
  });
  if (events.isLoading) return <LoadingSpinner />;
  if (events.error) return <ErrorMessage error={events.error} />;
  const data = events.data ?? [];
  if (data.length === 0)
    return <p className="text-sm text-forest-900/60">Inga händelser ännu.</p>;

  const completed = data.filter((e) => e.actualDate).length;
  const progress = Math.round((completed / data.length) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex justify-between text-xs text-forest-900/60">
          <span>Framsteg</span>
          <span>
            {completed} / {data.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-forest-200">
          <div
            className="h-full bg-forest-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {data.map((e) => (
          <TimelineItem key={e.id} event={e} />
        ))}
      </ol>
    </div>
  );
}

function TimelineItem({ event }: { event: DealEvent }) {
  const done = Boolean(event.actualDate);
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={clsx(
            "h-3 w-3 rounded-full border-2",
            done
              ? "border-forest-700 bg-forest-700"
              : "border-forest-500 bg-white",
          )}
        />
        <span className="mt-1 flex-1 w-px bg-forest-200" />
      </div>
      <div className="flex-1 pb-4">
        <p className="font-medium text-forest-900">{event.label}</p>
        <p className="text-xs text-forest-900/60">
          {event.actualDate
            ? `Genomfört ${formatDate(event.actualDate)}`
            : event.plannedDate
              ? `Planerat ${formatDate(event.plannedDate)}`
              : "Ej daterat"}
        </p>
        {event.note && (
          <p className="mt-1 text-sm text-forest-900/80">{event.note}</p>
        )}
      </div>
    </li>
  );
}

function EconomyTab({ dealId }: { dealId: string }) {
  const timber = useQuery({
    queryKey: ["deal", dealId, "timber"],
    queryFn: () => fetchDealTimber(dealId),
  });
  const costs = useQuery({
    queryKey: ["deal", dealId, "costs"],
    queryFn: () => fetchDealCosts(dealId),
  });

  const totals = useMemo(() => {
    const gross = (timber.data ?? []).reduce(
      (s: number, p: TimberPost) => s + Number(p.grossSek),
      0,
    );
    const cost = (costs.data ?? []).reduce(
      (s: number, c: DealCost) => s + Number(c.amountSek),
      0,
    );
    return { gross, cost, net: gross - cost };
  }, [timber.data, costs.data]);

  if (timber.isLoading || costs.isLoading) return <LoadingSpinner />;
  if (timber.error) return <ErrorMessage error={timber.error} />;
  if (costs.error) return <ErrorMessage error={costs.error} />;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-base">Virkesposter</h3>
        {(timber.data ?? []).length === 0 ? (
          <p className="text-sm text-forest-900/60">Inga poster ännu.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-forest-200">
            <table className="w-full text-sm">
              <thead className="bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-900/70">
                <tr>
                  <th className="px-3 py-2">Sortiment</th>
                  <th className="px-3 py-2 text-right">m³</th>
                  <th className="px-3 py-2 text-right">Pris</th>
                  <th className="px-3 py-2 text-right">Brutto</th>
                </tr>
              </thead>
              <tbody>
                {timber.data!.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-forest-200 align-top"
                  >
                    <td className="px-3 py-2">{p.assortment}</td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(p.volumeM3)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatSek(p.pricePerM3Sek)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatSek(p.grossSek)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-base">Kostnader</h3>
        {(costs.data ?? []).length === 0 ? (
          <p className="text-sm text-forest-900/60">Inga kostnader ännu.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-forest-200">
            <table className="w-full text-sm">
              <thead className="bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-900/70">
                <tr>
                  <th className="px-3 py-2">Typ</th>
                  <th className="px-3 py-2 text-right">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {costs.data!.map((c) => (
                  <tr key={c.id} className="border-t border-forest-200">
                    <td className="px-3 py-2">{c.costType}</td>
                    <td className="px-3 py-2 text-right">
                      {formatSek(c.amountSek)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-forest-200 bg-white p-4">
        <div className="flex justify-between text-sm">
          <span>Brutto</span>
          <span className="font-medium">{formatSek(totals.gross)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Kostnader</span>
          <span className="font-medium">−{formatSek(totals.cost)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-forest-200 pt-2">
          <span className="font-medium">Netto</span>
          <span className="font-display text-lg">{formatSek(totals.net)}</span>
        </div>
      </section>
    </div>
  );
}

function MessagesTab({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const messages = useQuery({
    queryKey: ["deal", dealId, "messages"],
    queryFn: () => fetchDealMessages(dealId),
  });

  const send = useMutation({
    mutationFn: (text: string) => sendDealMessage(dealId, text),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["deal", dealId, "messages"] });
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    send.mutate(trimmed);
  }

  if (messages.isLoading) return <LoadingSpinner />;
  if (messages.error) return <ErrorMessage error={messages.error} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-3">
        {(messages.data ?? []).length === 0 ? (
          <p className="text-sm text-forest-900/60">Inga meddelanden ännu.</p>
        ) : (
          messages.data!.map((m: Message) => (
            <MessageBubble
              key={m.id}
              message={m}
              own={m.senderId === user?.id}
            />
          ))
        )}
      </div>

      <form onSubmit={submit} className="sticky bottom-20 flex gap-2 pt-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv ett meddelande..."
          className="flex-1 rounded-lg border border-forest-200 bg-white px-3 py-2 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
        />
        <Button type="submit" disabled={send.isPending || !body.trim()}>
          {send.isPending ? "..." : "Skicka"}
        </Button>
      </form>
      {send.error && <ErrorMessage error={send.error} />}
    </div>
  );
}

function MessageBubble({ message, own }: { message: Message; own: boolean }) {
  return (
    <div className={clsx("flex", own ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          own
            ? "bg-forest-700 text-white"
            : "border border-forest-200 bg-white text-forest-900",
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p
          className={clsx(
            "mt-1 text-[10px]",
            own ? "text-white/70" : "text-forest-900/50",
          )}
        >
          {message.sender.name} · {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function DocumentsTab({ dealId }: { dealId: string }) {
  const docs = useQuery({
    queryKey: ["deal", dealId, "documents"],
    queryFn: () => fetchDealDocuments(dealId),
  });

  if (docs.isLoading) return <LoadingSpinner />;
  if (docs.error) return <ErrorMessage error={docs.error} />;
  const list = docs.data ?? [];
  if (list.length === 0)
    return <p className="text-sm text-forest-900/60">Inga dokument ännu.</p>;

  return (
    <ul className="space-y-2">
      {list.map((d: DocumentSummary) => (
        <li key={d.id}>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.filename}</p>
                <p className="text-xs text-forest-900/60">
                  {d.docType} · {(d.sizeBytes / 1024).toFixed(0)} kB ·{" "}
                  {formatDate(d.createdAt)}
                </p>
              </div>
              <Button variant="secondary" disabled title="Nedladdning kommer snart">
                Ladda ner
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
