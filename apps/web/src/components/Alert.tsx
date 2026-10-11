import clsx from 'clsx';

export function Alert({
  type = 'info',
  children,
}: {
  type?: 'info' | 'error' | 'success';
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-3 text-sm',
        type === 'error' && 'border-red-200 bg-red-50 text-red-800',
        type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        type === 'info' && 'border-brand-200 bg-brand-50 text-brand-900',
      )}
      role="alert"
    >
      {children}
    </div>
  );
}
