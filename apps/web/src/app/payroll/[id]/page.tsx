'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';

interface FormulaLine {
  labelFa: string;
  value: string;
  amount?: string;
}

interface ProposalDetail {
  id: string;
  status: string;
  proposedAmount: string;
  formulaBreakdownFa: FormulaLine[];
  reviewerNotes?: string | null;
  user: { firstName: string; lastName: string };
}

export default function PayrollDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const [userName, setUserName] = useState<string>();
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function init() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const data = await apiFetch<ProposalDetail>(`/payroll/proposals/${id}`);
        setProposal(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'خطا');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, id]);

  async function review(decision: 'APPROVED' | 'REJECTED') {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/payroll/proposals/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reviewerNotes: notes || undefined }),
      });
      const data = await apiFetch<ProposalDetail>(`/payroll/proposals/${id}`);
      setProposal(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بررسی ناموفق');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell userName={userName}>
      <Link href="/payroll" className="mb-4 inline-block text-sm text-brand-700">
        ← بازگشت
      </Link>
      {error && <Alert type="error">{error}</Alert>}
      {proposal && (
        <div className="card space-y-4">
          <h1 className="text-xl font-bold">
            پیشنهاد حقوق — {proposal.user.firstName} {proposal.user.lastName}
          </h1>
          <p>
            وضعیت: <strong>{proposal.status}</strong> — مبلغ: {proposal.proposedAmount}
          </p>
          <div>
            <h2 className="mb-2 font-semibold">جزئیات فرمول</h2>
            <ul className="space-y-1 text-sm">
              {proposal.formulaBreakdownFa?.map((line, i) => (
                <li key={i}>
                  <span className="text-[var(--muted)]">{line.labelFa}:</span> {line.value}
                </li>
              ))}
            </ul>
          </div>
          {proposal.status === 'PENDING_REVIEW' && (
            <div className="border-t border-[var(--border)] pt-4">
              <label className="block text-sm">
                یادداشت بازبین
                <textarea
                  className="input mt-1 w-full"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => review('APPROVED')}
                >
                  تأیید
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => review('REJECTED')}
                >
                  رد
                </button>
              </div>
            </div>
          )}
          {proposal.reviewerNotes && (
            <p className="text-sm text-[var(--muted)]">یادداشت: {proposal.reviewerNotes}</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
