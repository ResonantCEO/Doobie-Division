export type PromoSavingsResult<T> = {
  promo: T;
  savings: number;
};

export function normalizeSubmittedPromoCodes(codes: unknown[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of codes) {
    const code = String(value ?? "").trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Promo code ${code} was submitted more than once.`);
    }
    seen.add(key);
    normalized.push(code);
  }

  return normalized;
}

export function applyPromoSavingsInOrder<T>(
  startingTotal: number,
  promos: T[],
  calculateSavings: (promo: T, remainingTotal: number) => number,
): { totalSavings: number; remainingTotal: number; results: PromoSavingsResult<T>[] } {
  let remainingTotal = Math.max(0, Number(startingTotal) || 0);
  const results = promos.map((promo) => {
    const requestedSavings = Math.max(0, Number(calculateSavings(promo, remainingTotal)) || 0);
    const savings = Math.min(remainingTotal, requestedSavings);
    remainingTotal = Math.max(0, remainingTotal - savings);
    return { promo, savings };
  });

  return {
    totalSavings: results.reduce((sum, result) => sum + result.savings, 0),
    remainingTotal,
    results,
  };
}