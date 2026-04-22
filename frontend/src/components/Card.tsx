import clsx from "clsx";
import type { ReactNode, MouseEvent } from "react";

interface Props {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  className?: string;
}

export function Card({ children, onClick, className }: Props) {
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as unknown as MouseEvent<HTMLDivElement>);
        }
      }}
      className={clsx(
        "rounded-xl border border-forest-200 bg-white p-4 shadow-sm",
        interactive &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:border-forest-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-forest-500",
        className,
      )}
    >
      {children}
    </div>
  );
}
