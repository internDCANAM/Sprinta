/**
 * The API sends money as an integer count of minor units (1/100 SEK). The
 * division is the reason this is a function — rendering the raw value shows a
 * figure 100x too large, and it looks entirely plausible on screen.
 */
export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '—';
  return `${(minor / 100).toFixed(2)} kr`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toFixed(2);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sv-SE');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
