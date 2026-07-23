import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primario" | "secundario" | "perigo" }) {
  const base =
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const estilos = {
    primario: "bg-[var(--color-acento)] text-[#04202a] hover:brightness-110",
    secundario:
      "border border-[var(--color-borda)] text-[var(--color-texto)] hover:bg-[var(--color-superficie)]",
    perigo: "border border-red-500/40 text-red-300 hover:bg-red-500/10",
  }[variante];
  return <button className={`${base} ${estilos} ${className}`} {...props} />;
}

export function Campo({
  rotulo,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-fraco)]">
        {rotulo}
      </span>
      <input
        className={`w-full rounded-lg border border-[var(--color-borda)] bg-[var(--color-superficie)] px-3 py-2 text-sm outline-none focus:border-[var(--color-acento)] ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-borda)] bg-[var(--color-superficie)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}
