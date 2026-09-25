import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DurationUnit = "hours" | "days" | "weeks";
const UNIT_MS: Record<DurationUnit, number> = {
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

export default function BadgeDurationDialog({
  open,
  badgeLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  badgeLabel: string;
  onConfirm: (expiresAt: string | null) => void;
  onCancel: () => void;
}) {
  const [duration, setDuration] = useState("24");
  const [unit, setUnit] = useState<DurationUnit>("hours");
  const [neverDisengage, setNeverDisengage] = useState(false);
  const amount = Number(duration);
  const expiryTime = Date.now() + amount * UNIT_MS[unit];
  const validDuration =
    Number.isInteger(amount) && amount >= 1 &&
    Number.isFinite(expiryTime) && expiryTime <= 8.64e15;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How long should {badgeLabel} stay active?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The time starts now. Save the product to apply your choice.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            step="1"
            aria-label="Badge duration"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={neverDisengage}
          />
          <Select
            value={unit}
            onValueChange={(value: DurationUnit) => setUnit(value)}
            disabled={neverDisengage}
          >
            <SelectTrigger className="w-32 shrink-0" aria-label="Badge duration unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={neverDisengage}
            onCheckedChange={(checked) => setNeverDisengage(checked === true)}
          />
          Do not disengage (until I uncheck it)
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            type="button"
            disabled={!neverDisengage && !validDuration}
            onClick={() => onConfirm(neverDisengage ? null : new Date(expiryTime).toISOString())}
          >
            Apply badge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}