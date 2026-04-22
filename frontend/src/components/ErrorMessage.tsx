import { extractErrorMessage } from "../api/client";

export function ErrorMessage({ error }: { error: unknown }) {
  const msg = extractErrorMessage(error);
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {msg}
    </div>
  );
}
