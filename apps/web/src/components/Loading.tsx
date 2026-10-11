export function Loading({ label = 'در حال بارگذاری...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[var(--muted)]">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
