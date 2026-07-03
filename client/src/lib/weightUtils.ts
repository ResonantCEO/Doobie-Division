const OZ_IN_G = 28;
const LB_IN_G = 448; // 16 oz × 28g (cannabis convention)

export function formatWeight(totalGrams: number): string {
  if (totalGrams <= 0) return "0 g";

  const pounds = Math.floor(totalGrams / LB_IN_G);
  const afterPounds = totalGrams % LB_IN_G;
  const ounces = Math.floor(afterPounds / OZ_IN_G);
  const grams = Math.round((afterPounds % OZ_IN_G) * 100) / 100;

  const parts: string[] = [];
  if (pounds > 0) parts.push(`${pounds} lb`);
  if (ounces > 0) parts.push(`${ounces} oz`);
  if (grams > 0 || parts.length === 0) parts.push(`${grams} g`);

  return parts.join(" ");
}

export function gramsToBreakdown(totalGrams: number): { pounds: number; ounces: number; grams: number } {
  const pounds = Math.floor(totalGrams / LB_IN_G);
  const afterPounds = totalGrams % LB_IN_G;
  const ounces = Math.floor(afterPounds / OZ_IN_G);
  const grams = Math.round((afterPounds % OZ_IN_G) * 100) / 100;
  return { pounds, ounces, grams };
}
