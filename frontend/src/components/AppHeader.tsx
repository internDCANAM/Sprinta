import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-forest-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-mobile items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-7 w-7 rounded-md bg-forest-700"
            style={{
              background:
                "linear-gradient(135deg, var(--green-700), var(--green-500))",
            }}
          />
          <span className="font-display text-lg font-semibold text-forest-900">
            Sprintaiso
          </span>
        </div>
        {user && (
          <button
            onClick={() => void handleLogout()}
            className="rounded-md px-2.5 py-1.5 text-sm text-forest-700 hover:bg-forest-50"
          >
            Logga ut
          </button>
        )}
      </div>
    </header>
  );
}
