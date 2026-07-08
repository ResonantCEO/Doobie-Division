import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Pencil, Check, X, FileText, Weight, Hash, Layers } from "lucide-react";
import type { PriceTemplate } from "@shared/schema";

interface PriceTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TemplateType = "units" | "weight" | "quantity";

interface QuantityTier {
  minQuantity: string;
  pricePerItem: string;
}

interface TemplateForm {
  name: string;
  description: string;
  templateType: TemplateType;
  price: string;
  pricePerGram: string;
  pricePerOunce: string;
  pricePerEighth: string;
  pricePerQuarter: string;
  pricePerHalf: string;
  quantityTiers: QuantityTier[];
}

const emptyForm = (): TemplateForm => ({
  name: "",
  description: "",
  templateType: "units",
  price: "",
  pricePerGram: "",
  pricePerOunce: "",
  pricePerEighth: "",
  pricePerQuarter: "",
  pricePerHalf: "",
  quantityTiers: [{ minQuantity: "2", pricePerItem: "" }],
});

function templateFromRecord(t: PriceTemplate): TemplateForm {
  let tiers: QuantityTier[] = [{ minQuantity: "2", pricePerItem: "" }];
  if (t.quantityTiers) {
    try {
      tiers = JSON.parse(t.quantityTiers);
    } catch {}
  }
  return {
    name: t.name,
    description: t.description ?? "",
    templateType: (t.templateType ?? "units") as TemplateType,
    price: t.price ?? "",
    pricePerGram: t.pricePerGram ?? "",
    pricePerOunce: t.pricePerOunce ?? "",
    pricePerEighth: t.pricePerEighth ?? "",
    pricePerQuarter: t.pricePerQuarter ?? "",
    pricePerHalf: t.pricePerHalf ?? "",
    quantityTiers: tiers,
  };
}

function formToPayload(form: TemplateForm) {
  return {
    name: form.name,
    description: form.description || null,
    templateType: form.templateType,
    price: form.templateType === "units" && form.price ? form.price : null,
    pricePerGram: form.templateType === "weight" && form.pricePerGram ? form.pricePerGram : null,
    pricePerOunce: form.templateType === "weight" && form.pricePerOunce ? form.pricePerOunce : null,
    pricePerEighth: form.templateType === "weight" && form.pricePerEighth ? form.pricePerEighth : null,
    pricePerQuarter: form.templateType === "weight" && form.pricePerQuarter ? form.pricePerQuarter : null,
    pricePerHalf: form.templateType === "weight" && form.pricePerHalf ? form.pricePerHalf : null,
    quantityTiers: form.templateType === "quantity" ? JSON.stringify(form.quantityTiers) : null,
  };
}

const typeLabels: Record<TemplateType, string> = {
  units: "Unit Pricing",
  weight: "Weight Pricing",
  quantity: "Quantity Pricing",
};

const typeIcons: Record<TemplateType, typeof Hash> = {
  units: Hash,
  weight: Weight,
  quantity: Layers,
};

function TypeBadge({ type }: { type: string }) {
  const t = type as TemplateType;
  const Icon = typeIcons[t] ?? FileText;
  const colors: Record<string, string> = {
    units: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    weight: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    quantity: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[t] ?? ""}`}>
      <Icon className="h-3 w-3" />
      {typeLabels[t] ?? type}
    </span>
  );
}

function TemplateSummary({ template }: { template: PriceTemplate }) {
  const t = template.templateType as TemplateType;
  if (t === "units") {
    return <span className="text-sm text-muted-foreground">${template.price ?? "—"} / unit</span>;
  }
  if (t === "weight") {
    const parts: string[] = [];
    if (template.pricePerGram) parts.push(`$${template.pricePerGram}/g`);
    if (template.pricePerOunce) parts.push(`$${template.pricePerOunce}/oz`);
    if (template.pricePerEighth) parts.push(`$${template.pricePerEighth}/⅛`);
    if (template.pricePerQuarter) parts.push(`$${template.pricePerQuarter}/¼`);
    if (template.pricePerHalf) parts.push(`$${template.pricePerHalf}/½`);
    return <span className="text-sm text-muted-foreground">{parts.join(" · ") || "—"}</span>;
  }
  if (t === "quantity") {
    let tiers: QuantityTier[] = [];
    try { tiers = JSON.parse(template.quantityTiers ?? "[]"); } catch {}
    return (
      <span className="text-sm text-muted-foreground">
        {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
        {tiers.length > 0 && ` · ${tiers.map(t => `${t.minQuantity}+ @ $${t.pricePerItem}`).join(", ")}`}
      </span>
    );
  }
  return null;
}

export default function PriceTemplatesModal({ open, onOpenChange }: PriceTemplatesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm());

  const { data: templates = [], isLoading } = useQuery<PriceTemplate[]>({
    queryKey: ["/api/price-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/price-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      setCreating(false);
      setForm(emptyForm());
      toast({ title: "Template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/price-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      setEditingId(null);
      toast({ title: "Template updated" });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/price-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    const payload = formToPayload(form);
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (template: PriceTemplate) => {
    setForm(templateFromRecord(template));
    setEditingId(template.id);
    setCreating(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setCreating(false);
    setForm(emptyForm());
  };

  const handleStartCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm(emptyForm());
  };

  const setField = (key: keyof TemplateForm, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const showForm = creating || editingId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Price Templates
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Create reusable pricing templates to quickly apply standard prices when adding or editing products.
        </p>

        {/* Template list */}
        {!showForm && (
          <div className="space-y-3">
            {isLoading && (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                No templates yet. Create one to get started.
              </div>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <TypeBadge type={t.templateType} />
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  )}
                  <div className="mt-1">
                    <TemplateSummary template={t} />
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            <Button onClick={handleStartCreate} className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold text-sm">
              {editingId !== null ? "Edit Template" : "New Template"}
            </h3>

            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name *</label>
              <Input
                placeholder="e.g. Standard Flower Pricing"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                placeholder="Brief notes about when to use this template"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Template Type *</label>
              <Select
                value={form.templateType}
                onValueChange={(v) => setField("templateType", v as TemplateType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="units">Unit Pricing — flat price per item</SelectItem>
                  <SelectItem value="weight">Weight Pricing — prices per gram/oz/eighth etc.</SelectItem>
                  <SelectItem value="quantity">Quantity Pricing — tiered bulk discounts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Unit pricing fields */}
            {form.templateType === "units" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Price per Unit ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </div>
            )}

            {/* Weight pricing fields */}
            {form.templateType === "weight" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Fill in any weight options you want this template to set.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Price per Gram ($)</label>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.0000"
                      value={form.pricePerGram}
                      onChange={(e) => setField("pricePerGram", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Price per Ounce ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.pricePerOunce}
                      onChange={(e) => setField("pricePerOunce", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Price per ⅛ oz ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.pricePerEighth}
                      onChange={(e) => setField("pricePerEighth", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Price per ¼ oz ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.pricePerQuarter}
                      onChange={(e) => setField("pricePerQuarter", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Price per ½ oz ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.pricePerHalf}
                      onChange={(e) => setField("pricePerHalf", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quantity pricing tiers */}
            {form.templateType === "quantity" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Define quantity tiers — when a customer orders at least the minimum quantity, they get the lower price per item.
                </p>
                {form.quantityTiers.map((tier, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Min Qty</label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 3"
                        value={tier.minQuantity}
                        onChange={(e) => {
                          const updated = [...form.quantityTiers];
                          updated[i] = { ...updated[i], minQuantity: e.target.value };
                          setField("quantityTiers", updated);
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Price per item ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={tier.pricePerItem}
                        onChange={(e) => {
                          const updated = [...form.quantityTiers];
                          updated[i] = { ...updated[i], pricePerItem: e.target.value };
                          setField("quantityTiers", updated);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setField(
                          "quantityTiers",
                          form.quantityTiers.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setField("quantityTiers", [
                      ...form.quantityTiers,
                      { minQuantity: "", pricePerItem: "" },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tier
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                {editingId !== null ? "Save Changes" : "Create Template"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
