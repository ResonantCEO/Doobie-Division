import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Package, ShoppingBag, Gift, Plus, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import type { Product, GrabBag, Category, ProductSize } from "@shared/schema";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

interface BagItem { productId?: number; name: string; sku?: string; price?: string; selectedSize?: string | null }

function GenBagProductsList({
  bags,
  allProducts,
  onToggle,
  onDelete,
}: {
  bags: ProductWithSizes[];
  allProducts: ProductWithSizes[];
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

  const sorted = [...bags].sort(
    (a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)
  );

  return (
    <div className="space-y-2">
      {sorted.map(bag => {
        let meta: any = {};
        try { meta = JSON.parse((bag as any).adminNotes || "{}"); } catch {}
        const items: BagItem[] = Array.isArray(meta.items) ? meta.items : [];
        const templateName: string | null = meta.bagName || null;
        return (
          <div key={bag.id} className="border rounded-lg dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <div className="p-2 rounded-md shrink-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{bag.name}</span>
                  <Badge variant={bag.isActive ? "default" : "secondary"} className="text-xs shrink-0">
                    {bag.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {items.length > 0 && (
                    <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">${Number(bag.price).toFixed(2)}</span>
                  <span>{bag.stock ?? 0} in stock</span>
                  {templateName && <span className="text-gray-400">from template: {templateName}</span>}
                  <span className="font-mono text-gray-300 dark:text-gray-600">{bag.sku}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={bag.isActive ?? false}
                  onCheckedChange={checked => onToggle(bag.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete({ id: bag.id, name: bag.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
              {items.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No item data stored for this bag.</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Contents</p>
                  {items.map((item, idx) => {
                    const liveProduct = item.productId ? allProducts.find(p => p.id === item.productId) : undefined;
                    const sizeEntry = liveProduct?.sizes && item.selectedSize
                      ? liveProduct.sizes.find((s: any) => s.size === item.selectedSize)
                      : null;
                    const stock = sizeEntry != null ? (sizeEntry.quantity ?? 0) : (liveProduct?.stock ?? null);
                    const physical = sizeEntry != null ? (sizeEntry.physicalQuantity ?? null) : ((liveProduct as any)?.physicalInventory ?? null);
                    return (
                      <div key={idx} className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs flex items-center justify-center font-semibold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium truncate">{item.name}</span>
                          {item.selectedSize && (
                            <Badge variant="outline" className="text-xs shrink-0">{item.selectedSize}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {stock !== null && (
                            <span className={`text-xs font-medium ${(stock <= 0) ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {stock} stock
                              {physical !== null && <span className="text-gray-400 dark:text-gray-500"> / {physical} physical</span>}
                            </span>
                          )}
                          {item.price && (
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              ${Number(item.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.some(i => i.price) && (
                    <div className="flex justify-between items-center pt-2 mt-2 border-t dark:border-gray-700 text-xs font-semibold">
                      <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide">Retail value</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        ${items.reduce((sum, i) => sum + (i.price ? Number(i.price) : 0), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete generated bag?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.name}&rdquo; will be permanently removed from your catalog. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (pendingDelete) { onDelete(pendingDelete.id); setPendingDelete(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function BagsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [specificSearch, setSpecificSearch] = useState("");
  const [showSpecificList, setShowSpecificList] = useState(false);
  const [blacklistSearch, setBlacklistSearch] = useState("");
  const [showBlacklistList, setShowBlacklistList] = useState(false);
  const [showGrabBagModal, setShowGrabBagModal] = useState(false);
  const [editingGrabBag, setEditingGrabBag] = useState<GrabBag | null>(null);
  const [grabBagToDelete, setGrabBagToDelete] = useState<GrabBag | null>(null);
  const [deleteGrabBagConfirmOpen, setDeleteGrabBagConfirmOpen] = useState(false);
  const [grabBagToGenerate, setGrabBagToGenerate] = useState<GrabBag | null>(null);
  const [flavorPickerProduct, setFlavorPickerProduct] = useState<ProductWithSizes | null>(null);
  const [weightPickerProduct, setWeightPickerProduct] = useState<ProductWithSizes | null>(null);
  const [generateResultOpen, setGenerateResultOpen] = useState(false);

  type GrabBagPreview = {
    selectedProducts: { id: number; name: string; price: number; sku: string; sellingMethod?: string; weightLabel?: string; selectedSize?: string; imageUrl?: string | null; imageUrls?: string | null }[];
    retailValue: number; sellingPrice: number; bagId: number; bagName: string; warnings?: string[]
  };
  const [generatePreview, setGeneratePreview] = useState<GrabBagPreview | null>(null);
  const [generateResult, setGenerateResult] = useState<{ product: Product; selectedProducts: { name: string; price: number }[]; retailValue: number; sellingPrice: number } | null>(null);
  const [grabBagForm, setGrabBagForm] = useState({
    name: "",
    description: "",
    type: "standard" as "standard" | "customer_generated",
    sellingPrice: "",
    maxTotalItemPrice: "",
    specificProductIds: [] as { id: number; size?: string }[],
    categorySelections: [] as { categoryId: number; count: number }[],
    blacklistedProductIds: [] as number[],
    hideItems: false,
    isActive: true,
  });

  const resetGrabBagForm = () => setGrabBagForm({
    name: "", description: "", type: "standard", sellingPrice: "", maxTotalItemPrice: "",
    specificProductIds: [], categorySelections: [], blacklistedProductIds: [], hideItems: false, isActive: true,
  });

  const openEditGrabBag = (g: GrabBag) => {
    setEditingGrabBag(g);
    const bagType = ((g as any).type === 'customer_generated' ? 'customer_generated' : 'standard') as "standard" | "customer_generated";
    setGrabBagForm({
      name: g.name,
      description: g.description || "",
      type: bagType,
      sellingPrice: g.sellingPrice?.toString() || "",
      maxTotalItemPrice: g.maxTotalItemPrice?.toString() || "",
      specificProductIds: (() => {
        if (!g.specificProductIds) return [];
        try {
          const parsed = JSON.parse(g.specificProductIds);
          return parsed.map((item: any) => typeof item === 'number' ? { id: item } : item);
        } catch { return []; }
      })(),
      categorySelections: g.categorySelections ? JSON.parse(g.categorySelections) : [],
      blacklistedProductIds: g.blacklistedProductIds ? JSON.parse(g.blacklistedProductIds) : [],
      hideItems: bagType === 'customer_generated' ? true : (g.hideItems ?? false),
      isActive: g.isActive,
    });
    setShowGrabBagModal(true);
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: allGrabBags = [], isLoading: isLoadingGrabBags } = useQuery<GrabBag[]>({
    queryKey: ["/api/admin/grab-bags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grab-bags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch grab bags");
      return res.json();
    },
  });

  const { data: generatedBagProducts = [], isLoading: isLoadingGenBagProducts } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products/generated-bags"],
    queryFn: async () => {
      const res = await fetch("/api/products?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      const all = await res.json();
      return (all as ProductWithSizes[]).filter((p: ProductWithSizes) => p.sku?.startsWith("GRAB-BAG-"));
    },
    staleTime: 0,
  });

  const { data: allProducts = [] } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: categoriesResponse = [] } = useQuery<(Category & { children?: Category[] })[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const allCategories = useMemo(() => {
    const flatten = (cats: (Category & { children?: Category[] })[]): Category[] => {
      const result: Category[] = [];
      for (const cat of cats) {
        const { children, ...rest } = cat;
        result.push(rest);
        if (children && children.length > 0) result.push(...flatten(children));
      }
      return result;
    };
    return flatten(categoriesResponse);
  }, [categoriesResponse]);

  const categoriesWithStock = useMemo(() => {
    const ids = new Set<number>();
    for (const p of allProducts) {
      if ((p.stock ?? 0) > 0 || ((p as any).physicalInventory ?? 0) > 0) {
        if (p.categoryId) ids.add(p.categoryId);
      }
    }
    return ids;
  }, [allProducts]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const toggleGeneratedBagMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/products/${id}`, { isActive });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/generated-bags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => toast({ title: "Failed to update bag", variant: "destructive" }),
  });

  const deleteGeneratedBagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/generated-bags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Bag product deleted" });
    },
    onError: () => toast({ title: "Failed to delete bag product", variant: "destructive" }),
  });

  const createGrabBagMutation = useMutation({
    mutationFn: async (data: typeof grabBagForm) => {
      const isCg = data.type === 'customer_generated';
      const res = await apiRequest("POST", "/api/admin/grab-bags", {
        name: data.name,
        description: data.description || null,
        type: data.type,
        sellingPrice: data.sellingPrice,
        maxTotalItemPrice: data.maxTotalItemPrice,
        specificProductIds: !isCg && data.specificProductIds.length > 0 ? JSON.stringify(data.specificProductIds) : null,
        categorySelections: !isCg && data.categorySelections.length > 0 ? JSON.stringify(data.categorySelections) : null,
        blacklistedProductIds: data.blacklistedProductIds.length > 0 ? JSON.stringify(data.blacklistedProductIds) : null,
        hideItems: isCg ? true : data.hideItems,
        isActive: data.isActive,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grab-bags"] });
      setShowGrabBagModal(false);
      resetGrabBagForm();
      toast({ title: "Grab bag created" });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to create grab bag", variant: "destructive" }),
  });

  const updateGrabBagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof grabBagForm }) => {
      const isCg = data.type === 'customer_generated';
      const res = await apiRequest("PUT", `/api/admin/grab-bags/${id}`, {
        name: data.name,
        description: data.description || null,
        type: data.type,
        sellingPrice: data.sellingPrice,
        maxTotalItemPrice: data.maxTotalItemPrice,
        specificProductIds: !isCg && data.specificProductIds.length > 0 ? JSON.stringify(data.specificProductIds) : null,
        categorySelections: !isCg && data.categorySelections.length > 0 ? JSON.stringify(data.categorySelections) : null,
        blacklistedProductIds: data.blacklistedProductIds.length > 0 ? JSON.stringify(data.blacklistedProductIds) : null,
        hideItems: isCg ? true : data.hideItems,
        isActive: data.isActive,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grab-bags"] });
      setShowGrabBagModal(false);
      setEditingGrabBag(null);
      resetGrabBagForm();
      toast({ title: "Grab bag updated" });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to update grab bag", variant: "destructive" }),
  });

  const toggleGrabBagMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/grab-bags/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/grab-bags"] }),
    onError: () => toast({ title: "Failed to toggle grab bag", variant: "destructive" }),
  });

  const deleteGrabBagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/grab-bags/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/grab-bags"] });
      setDeleteGrabBagConfirmOpen(false);
      setGrabBagToDelete(null);
      toast({ title: "Grab bag deleted" });
    },
    onError: () => toast({ title: "Failed to delete grab bag", variant: "destructive" }),
  });

  const previewGrabBagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/grab-bags/${id}/preview`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratePreview(data);
      setGenerateResult(null);
      setGenerateResultOpen(true);
    },
    onError: (e: any) => toast({ title: e.message || "Failed to preview grab bag", variant: "destructive" }),
  });

  const confirmGrabBagMutation = useMutation({
    mutationFn: async ({ bagId, selectedProducts }: { bagId: number; selectedProducts: any[] }) => {
      const res = await apiRequest("POST", `/api/admin/grab-bags/${bagId}/generate`, { selectedProducts });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/generated-bags"] });
      setGenerateResult(data);
      setGeneratePreview(null);
      toast({ title: "Grab bag added to storefront!", description: `"${data.product.name}" is now live in your catalog.` });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to create grab bag product", variant: "destructive" }),
  });

  const generateGrabBagMutation = previewGrabBagMutation;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Grab Bags
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create grab bag templates with specific items or random category picks. Generate a product listing with one click.
              </p>
            </div>
            <Button onClick={() => { resetGrabBagForm(); setEditingGrabBag(null); setShowGrabBagModal(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Bag Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGrabBags ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
            </div>
          ) : allGrabBags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No grab bag templates yet</p>
              <p className="text-sm">Click "New Bag Template" to create your first grab bag.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allGrabBags.map((bag) => {
                const specificIds: number[] = bag.specificProductIds ? JSON.parse(bag.specificProductIds) : [];
                const catSels: { categoryId: number; count: number }[] = bag.categorySelections ? JSON.parse(bag.categorySelections) : [];
                return (
                  <div key={bag.id} className="flex items-start justify-between p-4 border rounded-lg dark:border-gray-700">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5 p-2 rounded-md shrink-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{bag.name}</span>
                          <Badge variant={bag.isActive ? "default" : "secondary"} className="text-xs">{bag.isActive ? 'Active' : 'Inactive'}</Badge>
                          {(bag as any).type === 'customer_generated'
                            ? <Badge variant="secondary" className="text-xs">Customer Generated</Badge>
                            : <Badge variant="secondary" className="text-xs">Standard</Badge>
                          }
                          <Badge variant="secondary" className="text-xs">Sells for ${Number(bag.sellingPrice).toFixed(2)}</Badge>
                          <Badge variant="secondary" className="text-xs">Target ${Number(bag.maxTotalItemPrice).toFixed(2)}</Badge>
                        </div>
                        {bag.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{bag.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          {(bag as any).type !== 'customer_generated' && specificIds.length > 0 && (
                            <span>{specificIds.length} specific item{specificIds.length !== 1 ? 's' : ''}</span>
                          )}
                          {(bag as any).type !== 'customer_generated' && catSels.length > 0 && (
                            <span>{catSels.reduce((s, c) => s + c.count, 0)} random from {catSels.length} categor{catSels.length !== 1 ? 'ies' : 'y'}</span>
                          )}
                          {(bag as any).type === 'customer_generated' && (
                            <span>Customer picks from all categories</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {(bag as any).type !== 'customer_generated' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-gray-700 border-gray-400 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
                          onClick={() => generateGrabBagMutation.mutate(bag.id)}
                          disabled={generateGrabBagMutation.isPending}
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          Generate
                        </Button>
                      )}
                      <Switch checked={bag.isActive} onCheckedChange={(checked) => toggleGrabBagMutation.mutate({ id: bag.id, isActive: checked })} />
                      <Button variant="ghost" size="sm" onClick={() => openEditGrabBag(bag)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setGrabBagToDelete(bag); setDeleteGrabBagConfirmOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Bag Products */}
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Generated Bag Products
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Live product listings created by generating bag templates. Toggle active to show/hide from storefront.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingGenBagProducts ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
            </div>
          ) : generatedBagProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingBag className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No generated bags yet</p>
              <p className="text-sm">Generate a bag from a template above to create a product listing.</p>
            </div>
          ) : (
            <GenBagProductsList
              bags={generatedBagProducts}
              allProducts={allProducts}
              onToggle={(id, isActive) => toggleGeneratedBagMutation.mutate({ id, isActive })}
              onDelete={(id) => deleteGeneratedBagMutation.mutate(id)}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Delete Grab Bag Confirmation */}
      <Dialog open={deleteGrabBagConfirmOpen} onOpenChange={setDeleteGrabBagConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Grab Bag Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <span className="font-semibold">{grabBagToDelete?.name}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGrabBagConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => grabBagToDelete && deleteGrabBagMutation.mutate(grabBagToDelete.id)} disabled={deleteGrabBagMutation.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Preview / Result Dialog */}
      <Dialog open={generateResultOpen} onOpenChange={(open) => { setGenerateResultOpen(open); if (!open) { setGeneratePreview(null); setGenerateResult(null); } }}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              {generateResult ? "Grab Bag Added!" : "Preview Grab Bag"}
            </DialogTitle>
            {!generateResult && generatePreview && (
              <p className="text-sm text-gray-500 mt-1">Review what would be in this bag before adding it to your storefront.</p>
            )}
          </DialogHeader>

          {generateResult && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  <span className="font-bold">"{generateResult.product.name}"</span> is now live in your catalog.
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">SKU: {generateResult.product.sku}</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items included</span>
                  <span className="font-medium">{generateResult.selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total retail value</span>
                  <span className="font-medium text-green-700 dark:text-green-400">${generateResult.retailValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Selling price</span>
                  <span className="font-medium">${generateResult.sellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer saves</span>
                  <span className="font-medium text-purple-600">${(generateResult.retailValue - generateResult.sellingPrice).toFixed(2)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items in this bag</p>
                <div className="space-y-1">
                  {generateResult.selectedProducts.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span>{p.name}</span>
                      <span className="text-gray-500">${p.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setGenerateResultOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}

          {generatePreview && !generateResult && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items selected</span>
                  <span className="font-medium">{generatePreview.selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total retail value</span>
                  <span className="font-medium text-green-700 dark:text-green-400">${generatePreview.retailValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Selling price</span>
                  <span className="font-medium">${generatePreview.sellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer saves</span>
                  <span className="font-medium text-purple-600">${(generatePreview.retailValue - generatePreview.sellingPrice).toFixed(2)}</span>
                </div>
              </div>
              {generatePreview.warnings && generatePreview.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg space-y-1">
                  <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Notices</p>
                  {generatePreview.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">• {w}</p>
                  ))}
                </div>
              )}
              {generatePreview.retailValue < generatePreview.sellingPrice && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    ⚠️ Retail value (${generatePreview.retailValue.toFixed(2)}) is below the selling price (${generatePreview.sellingPrice.toFixed(2)}). You can still add it, or adjust the bag settings.
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items that would be in this bag</p>
                <div className="space-y-1">
                  {generatePreview.selectedProducts.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="flex items-center gap-1.5">
                        {p.name}
                        {p.selectedSize && (
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {p.selectedSize}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-500 shrink-0 ml-2">
                        ${p.price.toFixed(2)}
                        {p.sellingMethod === "weight" && p.weightLabel
                          ? <span className="text-xs ml-0.5">/{p.weightLabel}</span>
                          : <span className="text-xs ml-1 text-gray-400">× 1</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setGenerateResultOpen(false)} disabled={confirmGrabBagMutation.isPending}>
                  Discard
                </Button>
                <Button
                  onClick={() => generatePreview && confirmGrabBagMutation.mutate({ bagId: generatePreview.bagId, selectedProducts: generatePreview.selectedProducts })}
                  disabled={confirmGrabBagMutation.isPending || !generatePreview}
                >
                  {confirmGrabBagMutation.isPending ? "Adding…" : "Add to Storefront"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Grab Bag Dialog */}
      <Dialog open={showGrabBagModal} onOpenChange={(open) => { setShowGrabBagModal(open); if (!open) { setEditingGrabBag(null); resetGrabBagForm(); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGrabBag ? "Edit" : "New"} Grab Bag Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Mystery Sampler"
                value={grabBagForm.name}
                onChange={e => setGrabBagForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description shown to customers"
                value={grabBagForm.description}
                onChange={e => setGrabBagForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Bag Type *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGrabBagForm(f => ({ ...f, type: 'standard' }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${grabBagForm.type === 'standard' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                >
                  <div className="font-medium text-sm">Standard</div>
                  <div className="text-xs text-gray-400 mt-0.5">Admin generates bags; customers buy the ready-made product</div>
                </button>
                <button
                  type="button"
                  onClick={() => setGrabBagForm(f => ({ ...f, type: 'customer_generated', hideItems: true }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${grabBagForm.type === 'customer_generated' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'}`}
                >
                  <div className="font-medium text-sm">Customer Generated</div>
                  <div className="text-xs text-gray-400 mt-0.5">Customer picks categories at checkout; bag assembled per order</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selling Price * <span className="text-gray-400 font-normal text-xs">(what customers pay)</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input className="pl-7" type="number" step="0.01" min="0" placeholder="0.00" value={grabBagForm.sellingPrice} onChange={e => setGrabBagForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Retail Value * <span className="text-gray-400 font-normal text-xs">(generator aims to get as close as possible)</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input className="pl-7" type="number" step="0.01" min="0" placeholder="0.00" value={grabBagForm.maxTotalItemPrice} onChange={e => setGrabBagForm(f => ({ ...f, maxTotalItemPrice: e.target.value }))} />
                </div>
                <p className="text-xs text-gray-400">Items selected will not exceed this total retail value.</p>
              </div>
            </div>

            {/* Specific Products — Standard bags only */}
            {grabBagForm.type === 'standard' && <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                Always Include — Specific Products
              </Label>
              <p className="text-xs text-gray-400">These products are always added to every generated bag.</p>
              <Input
                placeholder="Search products to add…"
                value={specificSearch}
                onChange={e => { setSpecificSearch(e.target.value); setShowSpecificList(true); }}
                onFocus={() => setShowSpecificList(true)}
                onBlur={() => setTimeout(() => setShowSpecificList(false), 150)}
                autoComplete="off"
              />
              {showSpecificList && (
                <div className="w-full border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 max-h-48 overflow-y-auto">
                  {(() => {
                    const term = specificSearch.toLowerCase();
                    const eligible = allProducts.filter(p =>
                      !term || p.name.toLowerCase().includes(term) || (allCategories.find(c => c.id === p.categoryId)?.name || "").toLowerCase().includes(term)
                    ).sort((a, b) => a.name.localeCompare(b.name));
                    if (eligible.length === 0) return <p className="px-3 py-2 text-sm text-gray-400">No products found</p>;
                    return eligible.map(p => {
                      const cat = allCategories.find(c => c.id === p.categoryId);
                      const totalStock = p.sizes && p.sizes.length > 0
                        ? p.sizes.reduce((s, sz) => s + (sz.quantity ?? 0), 0)
                        : (p.stock ?? 0);
                      const hasFlavors = p.sizes && p.sizes.length > 0;
                      const isWeightBased = p.sellingMethod === "weight";
                      const displayPrice = p.price
                        ? `$${Number(p.price).toFixed(2)}`
                        : (p as any).pricePerEighth
                        ? `$${Number((p as any).pricePerEighth).toFixed(2)}/⅛oz`
                        : (p as any).pricePerGram
                        ? `$${Number((p as any).pricePerGram).toFixed(2)}/g`
                        : isWeightBased ? "weight-based" : "no price";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between gap-2 border-b last:border-b-0 dark:border-gray-700"
                          onMouseDown={() => {
                            if (hasFlavors) {
                              setFlavorPickerProduct(p);
                            } else if (p.sellingMethod === "weight") {
                              setWeightPickerProduct(p);
                            } else {
                              setGrabBagForm(f => ({ ...f, specificProductIds: [...f.specificProductIds, { id: p.id }] }));
                            }
                            setSpecificSearch("");
                            setShowSpecificList(false);
                          }}
                        >
                          <span className="truncate font-medium">{p.name}{cat ? <span className="text-gray-400 font-normal"> · {cat.name}</span> : null}</span>
                          <span className="shrink-0 text-gray-500 text-xs">{displayPrice} · {hasFlavors ? `${p.sizes!.length} flavors` : `${totalStock} in stock`}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
              {grabBagForm.specificProductIds.length > 0 && (
                <div className="space-y-1 mt-2">
                  {grabBagForm.specificProductIds.map((entry, idx) => {
                    const prod = allProducts.find(p => p.id === entry.id);
                    const cat = prod ? allCategories.find(c => c.id === prod.categoryId) : null;
                    const isWeightBased = prod?.sellingMethod === "weight";
                    const sizeData = entry.size && prod?.sizes ? prod.sizes.find(s => s.size === entry.size) : null;
                    const weightTiers: Record<string, string | null | undefined> = prod ? {
                      "g": (prod as any).pricePerGram,
                      "⅛ oz": (prod as any).pricePerEighth,
                      "¼ oz": (prod as any).pricePerQuarter,
                      "½ oz": (prod as any).pricePerHalf,
                      "oz": (prod as any).pricePerOunce,
                    } : {};
                    const pinnedWeightPrice = isWeightBased && entry.size ? weightTiers[entry.size] : null;
                    const displayPrice = isWeightBased
                      ? (pinnedWeightPrice ? `$${Number(pinnedWeightPrice).toFixed(2)}/${entry.size}` : "weight-based")
                      : prod?.price ? `$${Number(prod.price).toFixed(2)}` : null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <span>
                          {prod ? prod.name : `Product #${entry.id}`}
                          {entry.size && !isWeightBased && <span className="text-blue-500 ml-1">({entry.size}{sizeData ? ` · ${sizeData.quantity} in stock` : ''})</span>}
                          {isWeightBased && entry.size && <span className="text-purple-500 ml-1">({entry.size})</span>}
                          {cat && !entry.size && <span className="text-gray-400 ml-1">({cat.name})</span>}
                          {displayPrice && <span className="text-gray-500"> — {displayPrice}</span>}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGrabBagForm(f => ({ ...f, specificProductIds: f.specificProductIds.filter((_, i) => i !== idx) }))}>
                          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}

            {/* Category Random Picks — Standard bags only */}
            {grabBagForm.type === 'standard' && <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                Random Category Picks
              </Label>
              <p className="text-xs text-gray-400">Randomly select a set number of items from a category each time the bag is generated.</p>
              <div className="flex gap-2">
                <Select
                  onValueChange={(val) => {
                    const catId = parseInt(val);
                    if (!grabBagForm.categorySelections.find(c => c.categoryId === catId)) {
                      setGrabBagForm(f => ({ ...f, categorySelections: [...f.categorySelections, { categoryId: catId, count: 1 }] }));
                    }
                  }}
                  value=""
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.filter(c => c.isActive && categoriesWithStock.has(c.id) && !c.name.toLowerCase().includes('grab bag') && !grabBagForm.categorySelections.find(s => s.categoryId === c.id)).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {grabBagForm.categorySelections.length > 0 && (
                <div className="space-y-2 mt-2">
                  {grabBagForm.categorySelections.map((sel, idx) => {
                    const cat = allCategories.find(c => c.id === sel.categoryId);
                    return (
                      <div key={sel.categoryId} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-sm flex-1">{cat?.name || `Category #${sel.categoryId}`}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Label className="text-xs text-gray-500 whitespace-nowrap">Pick count</Label>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            value={sel.count}
                            onChange={e => {
                              const count = Math.max(1, parseInt(e.target.value) || 1);
                              setGrabBagForm(f => ({
                                ...f,
                                categorySelections: f.categorySelections.map((s, i) => i === idx ? { ...s, count } : s),
                              }));
                            }}
                            className="w-16 h-8 text-center"
                          />
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGrabBagForm(f => ({ ...f, categorySelections: f.categorySelections.filter((_, i) => i !== idx) }))}>
                            <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}

            {/* Blacklisted Products */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Trash2 className="h-4 w-4 text-red-500" />
                Never Include — Blacklisted Products
              </Label>
              <p className="text-xs text-gray-400">These products will never be randomly picked from category selections for this bag.</p>
              <Input
                placeholder="Search products to exclude…"
                value={blacklistSearch}
                onChange={e => { setBlacklistSearch(e.target.value); setShowBlacklistList(true); }}
                onFocus={() => setShowBlacklistList(true)}
                onBlur={() => setTimeout(() => setShowBlacklistList(false), 150)}
                autoComplete="off"
              />
              {showBlacklistList && (
                <div className="w-full border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 max-h-48 overflow-y-auto">
                  {(() => {
                    const term = blacklistSearch.toLowerCase();
                    const eligible = allProducts.filter(p =>
                      !grabBagForm.blacklistedProductIds.includes(p.id) &&
                      (!term || p.name.toLowerCase().includes(term) || (allCategories.find(c => c.id === p.categoryId)?.name || "").toLowerCase().includes(term))
                    ).sort((a, b) => a.name.localeCompare(b.name));
                    if (eligible.length === 0) return <p className="px-3 py-2 text-sm text-gray-400">No products found</p>;
                    return eligible.map(p => {
                      const cat = allCategories.find(c => c.id === p.categoryId);
                      const isWeightBased = p.sellingMethod === "weight";
                      const displayPrice = p.price
                        ? `$${Number(p.price).toFixed(2)}`
                        : (p as any).pricePerEighth
                        ? `$${Number((p as any).pricePerEighth).toFixed(2)}/⅛oz`
                        : (p as any).pricePerGram
                        ? `$${Number((p as any).pricePerGram).toFixed(2)}/g`
                        : isWeightBased ? "weight-based" : "";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-between gap-2 border-b last:border-b-0 dark:border-gray-700"
                          onMouseDown={() => {
                            if (!grabBagForm.blacklistedProductIds.includes(p.id)) {
                              setGrabBagForm(f => ({ ...f, blacklistedProductIds: [...f.blacklistedProductIds, p.id] }));
                            }
                            setBlacklistSearch("");
                            setShowBlacklistList(false);
                          }}
                        >
                          <span className="truncate font-medium">{p.name}{cat ? <span className="text-gray-400 font-normal"> · {cat.name}</span> : null}</span>
                          {displayPrice && <span className="shrink-0 text-gray-500 text-xs">{displayPrice}</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
              {grabBagForm.blacklistedProductIds.length > 0 && (
                <div className="space-y-1 mt-2">
                  {grabBagForm.blacklistedProductIds.map(pid => {
                    const prod = allProducts.find(p => p.id === pid);
                    const cat = prod ? allCategories.find(c => c.id === prod.categoryId) : null;
                    return (
                      <div key={pid} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded text-sm">
                        <span className="text-red-700 dark:text-red-300">{prod ? `${prod.name}${cat ? ` (${cat.name})` : ''} — $${Number(prod.price).toFixed(2)}` : `Product #${pid}`}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGrabBagForm(f => ({ ...f, blacklistedProductIds: f.blacklistedProductIds.filter(id => id !== pid) }))}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Hide items toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Hide bag contents from customers</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {grabBagForm.type === 'customer_generated'
                    ? "Always on for Customer Generated bags — contents are assembled per order and never shown."
                    : "When on, customers won't see the item list on the storefront, add-to-cart screen, or shopping cart. Staff can always see the full contents on fulfillment screens."}
                </p>
              </div>
              <Switch
                checked={grabBagForm.type === 'customer_generated' ? true : grabBagForm.hideItems}
                disabled={grabBagForm.type === 'customer_generated'}
                onCheckedChange={v => grabBagForm.type !== 'customer_generated' && setGrabBagForm(f => ({ ...f, hideItems: v }))}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={grabBagForm.isActive} onCheckedChange={v => setGrabBagForm(f => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGrabBagModal(false); setEditingGrabBag(null); resetGrabBagForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!grabBagForm.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
                if (!grabBagForm.sellingPrice) return toast({ title: "Selling price is required", variant: "destructive" });
                if (!grabBagForm.maxTotalItemPrice) return toast({ title: "Target retail value is required", variant: "destructive" });
                if (editingGrabBag) {
                  updateGrabBagMutation.mutate({ id: editingGrabBag.id, data: grabBagForm });
                } else {
                  createGrabBagMutation.mutate(grabBagForm);
                }
              }}
              disabled={createGrabBagMutation.isPending || updateGrabBagMutation.isPending}
            >
              {editingGrabBag ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flavor Picker Dialog */}
      <Dialog open={!!flavorPickerProduct} onOpenChange={(open) => { if (!open) setFlavorPickerProduct(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Choose a Flavor</DialogTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {flavorPickerProduct?.name} — select a flavor to add to the bag.
            </p>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto py-1">
            {[...(flavorPickerProduct?.sizes ?? [])].sort((a, b) => a.size.localeCompare(b.size)).map(sz => (
              <button
                key={sz.size}
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                onClick={() => {
                  setGrabBagForm(f => ({
                    ...f,
                    specificProductIds: [...f.specificProductIds, { id: flavorPickerProduct.id, size: sz.size }],
                  }));
                  setFlavorPickerProduct(null);
                }}
              >
                <span className="font-medium text-sm">{sz.size}</span>
                <span className={`text-sm ${sz.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {sz.quantity} in stock
                </span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlavorPickerProduct(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Picker Dialog */}
      <Dialog open={!!weightPickerProduct} onOpenChange={(open) => { if (!open) setWeightPickerProduct(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Choose a Weight</DialogTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {weightPickerProduct?.name} — select which weight to always include in the bag.
            </p>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {weightPickerProduct && (() => {
              const p = weightPickerProduct as any;
              const tiers = [
                { label: "g",    price: p.pricePerGram },
                { label: "⅛ oz", price: p.pricePerEighth },
                { label: "¼ oz", price: p.pricePerQuarter },
                { label: "½ oz", price: p.pricePerHalf },
                { label: "oz",   price: p.pricePerOunce },
              ].filter(t => t.price != null && parseFloat(t.price) > 0);
              return tiers.map(t => (
                <button
                  key={t.label}
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  onClick={() => {
                    setGrabBagForm(f => ({
                      ...f,
                      specificProductIds: [...f.specificProductIds, { id: weightPickerProduct.id, size: t.label }],
                    }));
                    setWeightPickerProduct(null);
                  }}
                >
                  <span className="font-medium text-sm">{t.label}</span>
                  <span className="text-sm text-green-600 dark:text-green-400">${Number(t.price).toFixed(2)}</span>
                </button>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeightPickerProduct(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
