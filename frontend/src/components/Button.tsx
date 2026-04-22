import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest-700 text-white hover:bg-forest-900",
  secondary: "bg-forest-200 text-forest-900 hover:bg-forest-500 hover:text-white",
  ghost: "bg-transparent text-forest-700 hover:bg-forest-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  block,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={clsx(BASE, VARIANTS[variant], block && "w-full", className)}
      {...rest}
    />
  );
}
