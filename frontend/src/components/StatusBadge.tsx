import clsx from "clsx";
import type { DealStatus, PaymentStatus } from "@sprintaiso/api-types";

type Status = DealStatus | PaymentStatus;

const STYLES: Record<string, string> = {
  // Shared between DealStatus and PaymentStatus
  PLANNED: "bg-forest-50 text-forest-700 border-forest-200",
  COMPLETED: "bg-forest-200 text-forest-900 border-forest-500",
  // Deal only
  ONGOING: "bg-[color:var(--gold)]/10 text-[color:var(--gold)] border-[color:var(--gold)]/30",
  INVOICED: "bg-forest-500 text-white border-forest-500",
  CLOSED: "bg-forest-700 text-white border-forest-700",
  // Payment only
  FAILED: "bg-red-100 text-red-800 border-red-200",
};

const LABELS: Record<string, string> = {
  PLANNED: "Planerad",
  COMPLETED: "Klar",
  ONGOING: "Pågående",
  INVOICED: "Fakturerad",
  CLOSED: "Avslutad",
  FAILED: "Misslyckad",
};

export function StatusBadge({ status }: { status: Status }) {
  const style = STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const label = LABELS[status] ?? status;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style,
      )}
    >
      {label}
    </span>
  );
}
