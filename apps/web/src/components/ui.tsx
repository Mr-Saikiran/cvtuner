import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "btn--primary",
  secondary: "",
  ghost: "btn--quiet",
  danger: "btn--danger",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn ${VARIANTS[variant]} ${className}`} {...props} />;
}

/** A white plate in a 2px ink border over the hard offset — the page's one container. */
export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title || actions ? (
        <div className="card-head">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "text-ink-2 border-rule",
  good: "text-ink-2 border-ink",
  bad: "text-warn border-warn",
  warn: "text-warn border-warn",
  brand: "text-ink border-accent bg-accent-soft",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

/** Square cells joined edge to edge; the checked cell is ink with paper text. */
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
    <div role="radiogroup" aria-label={label} className="cells">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="cell"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The match as a catalogue figure: the number in Syne with its denominator in mono,
 * the way the theme sets a sample's size beside its code.
 */
export function Score({ value, label }: { value: number; label: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex items-baseline gap-1">
        <span className="figure-xl">{value}</span>
        <span className="code text-muted">/100</span>
      </p>
      <span className="text-muted text-xs leading-tight">{label}</span>
    </div>
  );
}
