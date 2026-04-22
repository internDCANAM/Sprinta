import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../auth/AuthProvider";

interface Item {
  to: string;
  label: string;
  icon: string;
}

const CUSTOMER_ITEMS: Item[] = [
  { to: "/deals", label: "Affärer", icon: "🌲" },
  { to: "/payments", label: "Utbetalningar", icon: "💰" },
  { to: "/profile", label: "Profil", icon: "👤" },
];

const ADMIN_ITEMS: Item[] = [{ to: "/admin", label: "Översikt", icon: "🗂" }];

export function BottomNav() {
  const { user } = useAuth();
  if (!user) return null;
  const items = user.role === "CUSTOMER" ? CUSTOMER_ITEMS : ADMIN_ITEMS;

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-forest-200 bg-white"
    >
      <ul className="mx-auto flex max-w-mobile">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === "/deals" || item.to === "/admin"}
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center gap-0.5 py-2 text-xs transition",
                  isActive
                    ? "text-forest-700 font-medium"
                    : "text-forest-900/60 hover:text-forest-700",
                )
              }
            >
              <span aria-hidden className="text-base">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
