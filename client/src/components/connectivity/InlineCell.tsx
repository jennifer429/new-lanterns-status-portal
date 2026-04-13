import { cn } from '@/lib/utils';

// ── Inline text cell — no chrome until focused ────────────────────────────────
export function InlineCell({
  value, onChange, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full bg-transparent border-none outline-none text-xs text-foreground',
        'placeholder:text-muted-foreground/35 focus:bg-primary/5 rounded px-1.5 py-1 min-h-[28px]',
        className
      )}
    />
  );
}
