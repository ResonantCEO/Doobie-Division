import React from "react";
import {
  Beer,
  Heart,
  Sparkles,
  Tag,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const PRODUCT_MANUAL_BADGES = [
  { key: "clearance", label: "Clearance" },
  { key: "daily_deals", label: "Daily Deals" },
  { key: "staff_favorite", label: "Staff Favorite" },
  { key: "new_item", label: "New Item" },
  { key: "pick_of_the_week", label: "Pick Of The Week" },
  { key: "thirsty_thursdays", label: "Thirsty Thursdays" },
] as const;

type ProductManualBadgeKey = (typeof PRODUCT_MANUAL_BADGES)[number]["key"];

type BadgeTreatment = {
  icon: LucideIcon;
  surface: string;
  iconSurface: string;
  text: string;
};

const BADGE_TREATMENTS: Record<ProductManualBadgeKey, BadgeTreatment> = {
  clearance: {
    icon: Tag,
    surface: "border-rose-200/80 bg-rose-950/90",
    iconSurface: "bg-rose-400 text-rose-950",
    text: "text-rose-50",
  },
  daily_deals: {
    icon: Zap,
    surface: "border-amber-200/80 bg-amber-950/90",
    iconSurface: "bg-amber-300 text-amber-950",
    text: "text-amber-50",
  },
  staff_favorite: {
    icon: Heart,
    surface: "border-pink-200/80 bg-pink-950/90",
    iconSurface: "bg-pink-300 text-pink-950",
    text: "text-pink-50",
  },
  new_item: {
    icon: Sparkles,
    surface: "border-cyan-200/80 bg-cyan-950/90",
    iconSurface: "bg-cyan-300 text-cyan-950",
    text: "text-cyan-50",
  },
  pick_of_the_week: {
    icon: Trophy,
    surface: "border-violet-200/80 bg-violet-950/90",
    iconSurface: "bg-violet-300 text-violet-950",
    text: "text-violet-50",
  },
  thirsty_thursdays: {
    icon: Beer,
    surface: "border-lime-200/80 bg-lime-950/90",
    iconSurface: "bg-lime-300 text-lime-950",
    text: "text-lime-50",
  },
};

const badgeLookup = new Map(PRODUCT_MANUAL_BADGES.map((badge) => [badge.key, badge]));

function ManualBadge({
  badgeKey,
  variant,
}: {
  badgeKey: ProductManualBadgeKey;
  variant: "card" | "preview";
}) {
  const badge = badgeLookup.get(badgeKey);
  const treatment = BADGE_TREATMENTS[badgeKey];
  if (!badge || !treatment) return null;

  const Icon = treatment.icon;
  const isCard = variant === "card";

  return (
    <span
      className={[
        "inline-flex min-w-0 items-center border font-semibold tracking-tight shadow-lg backdrop-blur-md",
        "transition-transform duration-200 hover:-translate-y-0.5",
        treatment.surface,
        treatment.text,
        isCard
          ? "max-w-full gap-1 rounded-full px-1.5 py-1 text-[9px] leading-none sm:gap-1.5 sm:px-2 sm:text-[10px]"
          : "gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
      ].join(" ")}
      title={badge.label}
    >
      <span
        className={[
          "flex shrink-0 items-center justify-center rounded-full",
          treatment.iconSurface,
          isCard ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-5 w-5",
        ].join(" ")}
      >
        <Icon
          aria-hidden="true"
          className={isCard ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-3 w-3"}
          strokeWidth={2.5}
        />
      </span>
      <span className="truncate">{badge.label}</span>
    </span>
  );
}

export default function ProductManualBadges({
  badges,
  variant = "card",
}: {
  badges?: string[] | null;
  variant?: "card" | "preview";
}) {
  const selectedBadges = PRODUCT_MANUAL_BADGES.filter((badge) =>
    badges?.includes(badge.key),
  );

  if (selectedBadges.length === 0) return null;

  if (variant === "preview") {
    return (
      <div
        className="flex flex-wrap gap-1.5"
        aria-label="Selected product badges"
      >
        {selectedBadges.map((badge) => (
          <ManualBadge key={badge.key} badgeKey={badge.key} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap justify-center gap-1 sm:gap-1.5"
      aria-label="Product badges"
    >
      {selectedBadges.map((badge) => (
        <ManualBadge key={badge.key} badgeKey={badge.key} variant={variant} />
      ))}
    </div>
  );
}