export function LoadingSpinner({ label = "Laddar..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-8 text-forest-700"
    >
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-forest-200 border-t-forest-700" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
