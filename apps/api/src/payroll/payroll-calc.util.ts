import { ContractType, Prisma } from '@prisma/client';

export type FormulaLine = { labelFa: string; value: string; amount?: string };

export function decimalAdd(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.add(b);
}

export function sumAdjustments(
  adjustments: { amount: Prisma.Decimal; isDeduction: boolean }[],
): Prisma.Decimal {
  return adjustments.reduce((acc, adj) => {
    if (adj.isDeduction) return acc.sub(adj.amount);
    return acc.add(adj.amount);
  }, new Prisma.Decimal(0));
}

export function calculateHourlyProposal(
  payableHours: Prisma.Decimal,
  hourlyRate: Prisma.Decimal,
  adjustments: { amount: Prisma.Decimal; isDeduction: boolean }[],
): { total: Prisma.Decimal; breakdown: FormulaLine[] } {
  const base = payableHours.mul(hourlyRate);
  const adjTotal = sumAdjustments(adjustments);
  const total = decimalAdd(base, adjTotal);
  const breakdown: FormulaLine[] = [
    { labelFa: 'ساعات قابل پرداخت تأییدشده', value: payableHours.toFixed(4) },
    { labelFa: 'نرخ ساعتی', value: hourlyRate.toFixed(4) },
    { labelFa: 'پایه (ساعت × نرخ)', value: base.toFixed(2), amount: base.toFixed(2) },
    { labelFa: 'جمع تعدیل‌ها', value: adjTotal.toFixed(2), amount: adjTotal.toFixed(2) },
    { labelFa: 'مبلغ پیشنهادی نهایی', value: total.toFixed(2), amount: total.toFixed(2) },
  ];
  return { total, breakdown };
}

export function calculateFixedProposal(
  baseMonthly: Prisma.Decimal,
  adjustments: { amount: Prisma.Decimal; isDeduction: boolean }[],
  flags: string[],
): { total: Prisma.Decimal; breakdown: FormulaLine[] } {
  const adjTotal = sumAdjustments(adjustments);
  const total = decimalAdd(baseMonthly, adjTotal);
  const breakdown: FormulaLine[] = [
    { labelFa: 'حقوق پایه ماهانه', value: baseMonthly.toFixed(2), amount: baseMonthly.toFixed(2) },
    {
      labelFa: 'توجه',
      value:
        'کسر خودکار بابت heartbeat/idle/امتیاز پایین اعمال نمی‌شود؛ فقط هشدار در پرچم‌ها.',
    },
    ...flags.map((f) => ({ labelFa: 'پرچم هشدار', value: f })),
    { labelFa: 'جمع تعدیل‌ها', value: adjTotal.toFixed(2), amount: adjTotal.toFixed(2) },
    { labelFa: 'مبلغ پیشنهادی نهایی', value: total.toFixed(2), amount: total.toFixed(2) },
  ];
  return { total, breakdown };
}

export function assertContractRates(
  type: ContractType,
  hourlyRate?: Prisma.Decimal | null,
  baseMonthly?: Prisma.Decimal | null,
) {
  if (type === 'HOURLY' && (!hourlyRate || hourlyRate.lte(0))) {
    throw new Error('نرخ ساعتی برای قرارداد ساعتی الزامی است');
  }
  if (type === 'FULL_TIME_REMOTE' && (!baseMonthly || baseMonthly.lte(0))) {
    throw new Error('حقوق پایه ماهانه برای قرارداد تمام‌وقت الزامی است');
  }
}
