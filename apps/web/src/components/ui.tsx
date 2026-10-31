import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50",
  secondary: "surface hover:border-brand-500 disabled:opacity-50",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50",
  danger: "text-red-600 hover:bg-red-500/10",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`surface rounded-2xl p-4 sm:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "bad" | "warn" | "brand"; children: ReactNode }) {
  const tones = {
    neutral: "bg-black/5 dark:bg-white/10",
    good: "bg-green-500/15 text-green-700 dark:text-green-400",
    bad: "bg-red-500/15 text-red-700 dark:text-red-400",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    brand: "bg-brand-500/15 text-brand-700 dark:text-brand-100",
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="surface inline-flex rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${value === o.value ? "bg-brand-600 text-white" : "muted hover:text-current"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ScoreRing({ value, label }: { value: number; label: ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = value >= 75 ? "#16a34a" : value >= 50 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{value}</text>
      </svg>
      <span className="muted text-xs leading-tight">{label}</span>
    </div>
  );
}
