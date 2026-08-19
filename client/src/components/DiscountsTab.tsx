import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Tag, Plus, Pencil, Trash2, Package, ArrowUp, ArrowDown, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { Product, PromoCode } from "@shared/schema";

export default function DiscountsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [promoCodeForm, setPromoCodeForm] = useState({
    code: "", description: "",
    discountType: "percent" as "percent" | "fixed" | "item_free" | "item_price",
    discountValue: "",
    targetProductIds: [] as number[],
    itemDealQuantity: "1",
    minOrderAmount: "",
    bypassPurchaseMinimum: false,
    usageLimitType: "unlimited" as "unlimited" | "once_per_user",
    maxTotalUses: "",
    isActive: true,
    validFrom: "", validTo: "",
  });
  const [showPromoCodeModal, setShowPromoCodeModal] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const [promoCodeToDelete, setPromoCodeToDelete] = useState<PromoCode | null>(null);
  const [deletePromoCodeConfirmOpen, setDeletePromoCodeConfirmOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const resetPromoCodeForm = () => setPromoCodeForm({
    code: "", description: "",
    discountType: "percent",
    discountValue: "",
    targetProductIds: [],
    itemDealQuantity: "1",
    minOrderAmount: "",
    bypassPurchaseMinimum: false,
    usageLimitType: "unlimited",
    maxTotalUses: "",
    isActive: true,
    validFrom: "", validTo: "",
  });

  const openEditPromoCode = (p: PromoCode) => {
    setEditingPromoCode(p);
    setPromoCodeForm({
      code: p.code,
      description: p.description || "",
      discountType: (p.discountType as "percent" | "fixed" | "item_free" | "item_price") || "percent",
      discountValue: p.discountValue?.toString() || "",
      targetProductIds: (() => {
        try {
          const ids = JSON.parse(p.targetProductIds || "[]");
          return Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [];
        } catch {
          return [];
        }
      })(),
      itemDealQuantity: String(p.itemDealQuantity || 1),
      minOrderAmount: p.minOrderAmount?.toString() || "",
      bypassPurchaseMinimum: p.bypassPurchaseMinimum || false,
      usageLimitType: (p.usageLimitType as "unlimited" | "once_per_user") || "unlimited",
      maxTotalUses: p.maxTotalUses?.toString() || "",
      isActive: p.isActive,
      validFrom: p.validFrom ? new Date(p.validFrom).toISOString().slice(0, 10) : "",
      validTo: p.validTo ? new Date(p.validTo).toISOString().slice(0, 10) : "",
    });
    setShowPromoCodeModal(true);
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: globalWeightPricingSetting, isLoading: isLoadingWeightPricing } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/settings/global_weight_pricing_enabled"],
  });
  const globalWeightPricingEnabled = globalWeightPricingSetting?.value !== "false";

  const { data: allPromoCodes = [], isLoading: isLoadingPromoCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promo-codes", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch promo codes");
      return res.json();
    },
    retry: 5,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
  });
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const isItemDeal = promoCodeForm.discountType === "item_free" || promoCodeForm.discountType === "item_price";
  const selectedDealProducts = promoCodeForm.targetProductIds
    .map(id => allProducts.find(product => product.id === id))
    .filter(Boolean) as Product[];
  const matchingProducts = allProducts.filter(product =>
    product.isActive &&
    !promoCodeForm.targetProductIds.includes(product.id) &&
    `${product.name} ${product.sku || ""}`.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);
  const promoSummary = (promo: PromoCode) => {
    if (promo.discountType === "item_free") return `Free item deal · ${promo.itemDealQuantity || 1} item${(promo.itemDealQuantity || 1) === 1 ? "" : "s"}`;
    if (promo.discountType === "item_price") return `$${Number(promo.discountValue).toFixed(2)} item deal · ${promo.itemDealQuantity || 1} item${(promo.itemDealQuantity || 1) === 1 ? "" : "s"}`;
    return promo.discountType === "percent" ? `${promo.discountValue}% off` : `$${Number(promo.discountValue).toFixed(2)} off`;
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const toggleWeightPricingMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PUT", "/api/admin/settings/global_weight_pricing_enabled", { value: String(enabled) }),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/global_weight_pricing_enabled"] });
      toast({ title: "Setting saved", description: `Global Weight Pricing has been ${enabled ? "enabled" : "disabled"}.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" }),
  });

  const createPromoCodeMutation = useMutation({
    mutationFn: async (data: typeof promoCodeForm) => {
      const payload: any = {
        code: data.code.toUpperCase().trim(),
        description: data.description || null,
        discountType: data.discountType,
        discountValue: data.discountType === "item_free" ? "0" : data.discountValue,
        targetProductIds: data.targetProductIds.length ? JSON.stringify(data.targetProductIds) : null,
        itemDealQuantity: parseInt(data.itemDealQuantity) || 1,
        minOrderAmount: data.minOrderAmount || null,
        bypassPurchaseMinimum: data.bypassPurchaseMinimum,
        usageLimitType: data.usageLimitType,
        isActive: data.isActive,
        validFrom: data.validFrom || null,
        validTo: data.validTo || null,
      };
      if (data.maxTotalUses) payload.maxTotalUses = parseInt(data.maxTotalUses);
      const res = await apiRequest("POST", "/api/admin/promo-codes", payload);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setShowPromoCodeModal(false);
      resetPromoCodeForm();
      toast({ title: "Promo code created" });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to create promo code", variant: "destructive" }),
  });

  const updatePromoCodeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof promoCodeForm }) => {
      const payload: any = {
        code: data.code.toUpperCase().trim(),
        description: data.description || null,
        discountType: data.discountType,
        discountValue: data.discountType === "item_free" ? "0" : data.discountValue,
        targetProductIds: data.targetProductIds.length ? JSON.stringify(data.targetProductIds) : null,
        itemDealQuantity: parseInt(data.itemDealQuantity) || 1,
        minOrderAmount: data.minOrderAmount || null,
        bypassPurchaseMinimum: data.bypassPurchaseMinimum,
        usageLimitType: data.usageLimitType,
        maxTotalUses: data.maxTotalUses ? parseInt(data.maxTotalUses) : null,
        isActive: data.isActive,
        validFrom: data.validFrom || null,
        validTo: data.validTo || null,
      };
      const res = await apiRequest("PUT", `/api/admin/promo-codes/${id}`, payload);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setShowPromoCodeModal(false);
      setEditingPromoCode(null);
      resetPromoCodeForm();
      toast({ title: "Promo code updated" });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to update promo code", variant: "destructive" }),
  });

  const togglePromoCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/promo-codes/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] }),
    onError: () => toast({ title: "Failed to toggle promo code", variant: "destructive" }),
  });

  const deletePromoCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/promo-codes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setDeletePromoCodeConfirmOpen(false);
      setPromoCodeToDelete(null);
      toast({ title: "Promo code deleted" });
    },
    onError: () => toast({ title: "Failed to delete promo code", variant: "destructive" }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Global Weight Pricing Toggle */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">Global Weight Pricing</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                When active, the total weight of all weight-based items in a cart is combined so customers qualify for better price tiers across mixed products.
              </p>
            </div>
            <Switch
              checked={globalWeightPricingEnabled}
              onCheckedChange={(enabled) => toggleWeightPricingMutation.mutate(enabled)}
              disabled={isLoadingWeightPricing || toggleWeightPricingMutation.isPending}
              className="mt-1 shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Promo Codes
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create discount codes customers enter at checkout — % off, flat amounts, or minimum bypasses.
              </p>
            </div>
            <Button onClick={() => { resetPromoCodeForm(); setEditingPromoCode(null); setShowPromoCodeModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPromoCodes ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
            </div>
          ) : allPromoCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Tag className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No promo codes yet</p>
              <p className="text-sm">Click "Create Code" to add your first promo code.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPromoCodes.map((p) => (
                <div key={p.id} className="border rounded-lg dark:border-gray-700 overflow-hidden">

                  {/* Mobile card layout */}
                  <div className="md:hidden">
                    <div className={`flex items-center justify-between px-4 py-3 ${p.isActive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag className={`h-4 w-4 shrink-0 ${p.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                        <span className="font-mono font-bold tracking-wider text-base truncate">{p.code}</span>
                      </div>
                      <Badge variant={p.isActive ? "default" : "secondary"} className="shrink-0 ml-2">
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-sm font-semibold">
                          {promoSummary(p)}
                        </Badge>
                        {p.minOrderAmount && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Min. ${Number(p.minOrderAmount).toFixed(2)}</Badge>
                        )}
                        {p.bypassPurchaseMinimum && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">Bypasses min. purchase</Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{p.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{p.usageLimitType === 'once_per_user' ? 'Once per customer' : 'Unlimited uses'}</span>
                        {p.maxTotalUses && <span>· Max {p.maxTotalUses} uses</span>}
                        <span>· Used {p.totalUses}×</span>
                      </div>
                      {(p.validFrom || p.validTo) && (
                        <div className="text-xs text-gray-400">
                          {p.validFrom && `From ${format(new Date(p.validFrom), 'MMM d, yyyy')}`}
                          {p.validFrom && p.validTo && ' – '}
                          {p.validTo && `Until ${format(new Date(p.validTo), 'MMM d, yyyy')}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.isActive}
                          onCheckedChange={(checked) => togglePromoCodeMutation.mutate({ id: p.id, isActive: checked })}
                        />
                        <span className="text-xs text-gray-500">{p.isActive ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditPromoCode(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => { setPromoCodeToDelete(p); setDeletePromoCodeConfirmOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Desktop card layout */}
                  <div className="hidden md:flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-2 rounded-md ${p.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                        <Tag className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold tracking-wider text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{p.code}</span>
                          <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">{p.isActive ? 'Active' : 'Inactive'}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {promoSummary(p)}
                          </Badge>
                          {p.minOrderAmount && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Min. ${Number(p.minOrderAmount).toFixed(2)}</Badge>
                          )}
                          {p.bypassPurchaseMinimum && (
                            <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">Bypasses min. purchase</Badge>
                          )}
                        </div>
                        {p.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{p.description}</p>}
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          <span>{p.usageLimitType === 'once_per_user' ? 'Once per customer' : 'Unlimited uses'}</span>
                          {p.maxTotalUses && <span>· Max {p.maxTotalUses} total uses</span>}
                          <span>· Used {p.totalUses} time{p.totalUses !== 1 ? 's' : ''}</span>
                          {(p.validFrom || p.validTo) && (
                            <span>
                              · {p.validFrom ? `From ${format(new Date(p.validFrom), 'MMM d, yyyy')}` : ''}
                              {p.validFrom && p.validTo ? ' – ' : ''}
                              {p.validTo ? `Until ${format(new Date(p.validTo), 'MMM d, yyyy')}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.isActive} onCheckedChange={(checked) => togglePromoCodeMutation.mutate({ id: p.id, isActive: checked })} />
                      <Button variant="ghost" size="sm" onClick={() => openEditPromoCode(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setPromoCodeToDelete(p); setDeletePromoCodeConfirmOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Delete Promo Code Confirmation */}
      <Dialog open={deletePromoCodeConfirmOpen} onOpenChange={setDeletePromoCodeConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Promo Code</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete the code <span className="font-mono font-bold">{promoCodeToDelete?.code}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePromoCodeConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => promoCodeToDelete && deletePromoCodeMutation.mutate(promoCodeToDelete.id)} disabled={deletePromoCodeMutation.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Promo Code Dialog */}
      <Dialog open={showPromoCodeModal} onOpenChange={(open) => { setShowPromoCodeModal(open); if (!open) { setEditingPromoCode(null); resetPromoCodeForm(); } }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromoCode ? "Edit" : "New"} Promo Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                placeholder="e.g. SAVE20"
                value={promoCodeForm.code}
                onChange={e => setPromoCodeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="font-mono uppercase tracking-widest"
              />
              <p className="text-xs text-gray-400">Customers enter this at checkout. Automatically uppercased.</p>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input placeholder="e.g. 20% off for VIP customers" value={promoCodeForm.description} onChange={e => setPromoCodeForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select value={promoCodeForm.discountType} onValueChange={v => setPromoCodeForm(f => ({ ...f, discountType: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage off (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                    <SelectItem value="item_free">Free selected item(s)</SelectItem>
                    <SelectItem value="item_price">Selected item(s) for a set price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {promoCodeForm.discountType !== "item_free" && <div className="space-y-2">
                <Label>{promoCodeForm.discountType === 'percent' ? 'Percent Off *' : promoCodeForm.discountType === "item_price" ? 'Promotional Price Per Item *' : 'Dollar Amount Off *'}</Label>
                <Input
                  type="number" min="0" step={promoCodeForm.discountType === 'percent' ? "1" : "0.01"}
                  placeholder={promoCodeForm.discountType === 'percent' ? "e.g. 20" : promoCodeForm.discountType === "item_price" ? "e.g. 5.00" : "e.g. 10.00"}
                  value={promoCodeForm.discountValue}
                  onChange={e => setPromoCodeForm(f => ({ ...f, discountValue: e.target.value }))}
                />
              </div>}
            </div>
            {isItemDeal && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                <div>
                  <Label>Eligible Items (priority order) *</Label>
                  <p className="text-xs text-muted-foreground mt-1">The deal is applied to eligible cart items in this order.</p>
                </div>
                {selectedDealProducts.length > 0 && (
                  <div className="space-y-2">
                    {selectedDealProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm">
                        <span className="w-5 text-muted-foreground">{index + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">{product.name}{product.sku ? <span className="ml-1 text-xs text-muted-foreground">({product.sku})</span> : null}</span>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => setPromoCodeForm(f => {
                          const ids = [...f.targetProductIds];
                          [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                          return { ...f, targetProductIds: ids };
                        })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === selectedDealProducts.length - 1} onClick={() => setPromoCodeForm(f => {
                          const ids = [...f.targetProductIds];
                          [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                          return { ...f, targetProductIds: ids };
                        })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setPromoCodeForm(f => ({ ...f, targetProductIds: f.targetProductIds.filter(id => id !== product.id) }))}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products to add…" />
                {productSearch && (
                  <div className="max-h-40 overflow-y-auto rounded border bg-background">
                    {matchingProducts.length ? matchingProducts.map(product => (
                      <button type="button" key={product.id} className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => {
                        setPromoCodeForm(f => ({ ...f, targetProductIds: [...f.targetProductIds, product.id] }));
                        setProductSearch("");
                      }}>
                        {product.name}{product.sku ? <span className="ml-1 text-xs text-muted-foreground">({product.sku})</span> : null}
                      </button>
                    )) : <p className="px-3 py-2 text-sm text-muted-foreground">No matching available products.</p>}
                  </div>
                )}
                <div className="max-w-[220px] space-y-2">
                  <Label>Deal applies to up to</Label>
                  <Input type="number" min="1" step="1" value={promoCodeForm.itemDealQuantity} onChange={e => setPromoCodeForm(f => ({ ...f, itemDealQuantity: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">eligible item(s) per order.</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Usage Limit</Label>
              <Select value={promoCodeForm.usageLimitType} onValueChange={v => setPromoCodeForm(f => ({ ...f, usageLimitType: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited — any customer can use it any number of times</SelectItem>
                  <SelectItem value="once_per_user">Once per customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Total Uses (optional)</Label>
              <Input type="number" min="1" placeholder="Leave blank for unlimited" value={promoCodeForm.maxTotalUses} onChange={e => setPromoCodeForm(f => ({ ...f, maxTotalUses: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Order Amount (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 200.00 — leave blank for no minimum" className="pl-7" value={promoCodeForm.minOrderAmount} onChange={e => setPromoCodeForm(f => ({ ...f, minOrderAmount: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">Customer's cart must reach this amount before the code can be applied.</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={promoCodeForm.bypassPurchaseMinimum} onCheckedChange={v => setPromoCodeForm(f => ({ ...f, bypassPurchaseMinimum: v }))} />
              <div>
                <Label>Bypass purchase minimum</Label>
                <p className="text-xs text-gray-400">When enabled, this code lets customers skip city purchase minimums.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valid From (optional)</Label>
                <Input type="date" value={promoCodeForm.validFrom} onChange={e => setPromoCodeForm(f => ({ ...f, validFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input type="date" value={promoCodeForm.validTo} onChange={e => setPromoCodeForm(f => ({ ...f, validTo: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={promoCodeForm.isActive} onCheckedChange={v => setPromoCodeForm(f => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPromoCodeModal(false); setEditingPromoCode(null); resetPromoCodeForm(); }}>Cancel</Button>
            <Button
              disabled={!promoCodeForm.code || (promoCodeForm.discountType !== "item_free" && !promoCodeForm.discountValue) || (isItemDeal && promoCodeForm.targetProductIds.length === 0) || createPromoCodeMutation.isPending || updatePromoCodeMutation.isPending}
              onClick={() => {
                if (editingPromoCode) {
                  updatePromoCodeMutation.mutate({ id: editingPromoCode.id, data: promoCodeForm });
                } else {
                  createPromoCodeMutation.mutate(promoCodeForm);
                }
              }}
            >
              {editingPromoCode ? "Save Changes" : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
