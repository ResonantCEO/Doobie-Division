const priceFields = ["price", "pricePerGram", "pricePerOunce", "pricePerEighth", "pricePerQuarter", "pricePerHalf"] as const;
const overrideFields = ["discountPriceOverride", "discountPricePerGram", "discountPricePerOunce", "discountPricePerEighth", "discountPricePerQuarter", "discountPricePerHalf"] as const;

export function hasProductDiscount(product: any): boolean {
  return Number(product.configuredDiscountPercentage ?? product.discountPercentage) > 0
    || Number(product.configuredDiscountAmount ?? product.discountAmount) > 0
    || overrideFields.some(field => (product[`configured${field[0].toUpperCase()}${field.slice(1)}`] ?? product[field]) != null)
    || (product.configuredDiscountQuantityPricing ?? product.discountQuantityPricing ?? []).length > 0
    || Boolean(product.configuredBogoEnabled ?? product.bogoEnabled);
}

/** Overlapping windows are one uninterrupted offer, not additional allowances. */
export function getDiscountCycleKey(product: any, now = Date.now()): string | null {
  if (!hasProductDiscount(product)) return null;
  const campaign = product.discountCampaignId;
  if (!campaign) return null;
  if (Array.isArray(product.discountSchedule) && product.discountSchedule.length) {
    const windows = product.discountSchedule.map((w: any) => ({
      start: new Date(w.startAt).getTime(), end: new Date(w.endAt).getTime(),
      key: w.id || String(new Date(w.startAt).getTime()),
    })).filter((w: any) => Number.isFinite(w.start) && w.end > w.start).sort((a: any, b: any) => a.start - b.start);
    const merged: Array<{ start: number; end: number; key: string }> = [];
    for (const window of windows) {
      const last = merged[merged.length - 1];
      if (last && window.start < last.end) last.end = Math.max(last.end, window.end);
      else merged.push({ ...window });
    }
    const active = merged.find(w => w.start <= now && now < w.end);
    return active ? `${campaign}:${active.key}` : null;
  }
  const start = product.discountStartsAt ? new Date(product.discountStartsAt).getTime() : null;
  const end = product.discountExpiresAt ? new Date(product.discountExpiresAt).getTime() : null;
  if ((start !== null && (!Number.isFinite(start) || now < start))
    || (end !== null && (!Number.isFinite(end) || now >= end))) return null;
  return `${campaign}:immediate`;
}

/** Preserve identity when the editor rounds seconds or adjusts a continuous window. */
export function preserveDiscountWindowKeys(previous: any, next: any[], now = Date.now()): any[] {
  const oldWindows = Array.isArray(previous.discountSchedule) && previous.discountSchedule.length
    ? previous.discountSchedule.map((w: any) => ({
      start: new Date(w.startAt).getTime(), end: new Date(w.endAt).getTime(),
      key: w.id || String(new Date(w.startAt).getTime()), legacy: false,
    }))
    : [{
      start: previous.discountStartsAt ? new Date(previous.discountStartsAt).getTime() : -Infinity,
      end: previous.discountExpiresAt ? new Date(previous.discountExpiresAt).getTime() : Infinity,
      key: "immediate",
      legacy: true,
    }];
  const assigned: Array<{ key: string; start: number; end: number }> = [];
  return [...next].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).map(window => {
    const start = new Date(window.startAt).getTime();
    const end = new Date(window.endAt).getTime();
    const match = oldWindows.find((old: any) => {
      if (!old.legacy) return start < old.end && end > old.start;
      return (old.start <= now && now < old.end && start <= now && now < end)
        || (Number.isFinite(old.start) && Math.floor(start / 60000) === Math.floor(old.start / 60000));
    });
    const alreadyAssigned = assigned.filter(entry => match && entry.key === match.key);
    const canReuse = match && (!alreadyAssigned.length || alreadyAssigned.some(entry => start < entry.end && end > entry.start));
    const key = canReuse ? match.key : String(start);
    assigned.push({ key, start, end });
    return { ...window, id: key };
  });
}

export function standardProduct(product: any): any {
  const result = { ...product, discountPercentage: "0", discountAmount: "0", bogoEnabled: false };
  for (const field of priceFields) {
    const standard = `standard${field[0].toUpperCase()}${field.slice(1)}`;
    result[field] = product[standard] !== undefined ? product[standard] : product[field];
  }
  result.quantityPricing = product.standardQuantityPricing ?? product.quantityPricing ?? [];
  return result;
}

/** Works with raw database rows and the existing configured/standard read snapshots. */
export function offerProduct(product: any, now = Date.now()): any {
  const result = standardProduct(product);
  if (!getDiscountCycleKey(product, now)) return result;
  for (let index = 0; index < priceFields.length; index++) {
    const field = overrideFields[index];
    const override = product[`configured${field[0].toUpperCase()}${field.slice(1)}`] ?? product[field];
    if (override != null) result[priceFields[index]] = override;
  }
  const tiers = product.configuredDiscountQuantityPricing ?? product.discountQuantityPricing ?? [];
  if (tiers.length) result.quantityPricing = tiers;
  const replacement = overrideFields.some(field => (product[`configured${field[0].toUpperCase()}${field.slice(1)}`] ?? product[field]) != null) || tiers.length > 0;
  result.discountPercentage = replacement ? "0" : product.configuredDiscountPercentage ?? product.discountPercentage ?? "0";
  result.discountAmount = replacement ? "0" : product.configuredDiscountAmount ?? product.discountAmount ?? "0";
  result.bogoEnabled = product.configuredBogoEnabled ?? product.bogoEnabled ?? false;
  result.bogoDiscountType = product.configuredBogoDiscountType ?? product.bogoDiscountType ?? "free";
  result.bogoDiscountValue = product.configuredBogoDiscountValue ?? product.bogoDiscountValue ?? "0";
  result.bogoFreeOptionIndex = product.configuredBogoFreeOptionIndex ?? product.bogoFreeOptionIndex ?? null;
  return result;
}

export function discountFingerprint(product: any): string {
  const standard = standardProduct(product);
  const offer = offerProduct(product);
  return JSON.stringify([
    product.discountItemLimit, getDiscountCycleKey(product), product.sellingMethod,
    priceFields.map(field => standard[field] ?? null),
    priceFields.map(field => offer[field] ?? null),
    [standard.quantityPricing, offer.quantityPricing].map(tiers => tiers.map((t: any) => [Number(t.minQuantity), String(t.pricePerItem)]).sort((a: any, b: any) => a[0] - b[0])),
    offer.discountPercentage, offer.discountAmount, offer.bogoEnabled,
    offer.bogoDiscountType, offer.bogoDiscountValue, offer.bogoFreeOptionIndex,
  ]);
}