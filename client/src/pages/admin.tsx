import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { MessageCircle, User as UserIcon, Clock, AlertTriangle, Eye, Send, ArrowUpDown, ArrowUp, ArrowDown, Trash2, MapPin, Plus, DollarSign, Pencil, TruckIcon, Archive, Trash, KeyRound, Calendar, Eye as EyeIcon, EyeOff, Tag, Percent, Package, ShoppingBag, Gift, Lock, ImagePlus, X, Loader2, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { InventoryLog, Product, User, SupportTicket, CityPurchaseLimit, AccessPassword, Discount, PromoCode, GrabBag, Category, ProductSize } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type ProductWithSizes = Product & { sizes?: ProductSize[] };

function toLocalDateTimeString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

interface InventoryLogWithDetails extends InventoryLog {
  product: Product | null;
  user: User | null;
}

interface SupportTicketResponse {
  id: number;
  message: string;
  type: string;
  imageUrls: string | null;
  createdAt: Date | string;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

interface SupportTicketWithDetails {
  ticket: SupportTicket;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  assignedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  responses?: SupportTicketResponse[];
}

type SortField = 'createdAt' | 'product' | 'sku' | 'type' | 'quantity' | 'previousStock' | 'newStock' | 'changedBy' | 'reason';
type SortDirection = 'asc' | 'desc';

// ── Generated Bag Products List ────────────────────────────────────────────
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
            {/* Row */}
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

            {/* Items — always visible */}
            <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No item data stored for this bag.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Contents</p>
                    {items.map((item, idx) => {
                      const liveProduct = item.productId ? allProducts.find(p => p.id === item.productId) : undefined;
                      // For sized products, use the specific size's quantity; fall back to product-level stock
                      const sizeEntry = liveProduct?.sizes && item.selectedSize
                        ? liveProduct.sizes.find((s: any) => s.size === item.selectedSize)
                        : null;
                      const stock = sizeEntry != null ? (sizeEntry.quantity ?? 0) : (liveProduct?.stock ?? null);
                      const physical = sizeEntry != null ? (sizeEntry.physicalQuantity ?? null) : ((liveProduct as any)?.physicalInventory ?? null);
                      const threshold = (liveProduct as any)?.minStockThreshold ?? 0;
                      const stockLow = stock !== null && stock > 0 && stock <= threshold;
                      const stockOut = stock !== null && stock <= 0;
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
                    {/* Total retail value */}
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

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  useWebSocket();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("support");
  const [dateFilter, setDateFilter] = useState("7"); // days
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketResponse, setTicketResponse] = useState("");
  const [responseType, setResponseType] = useState("customer_response");
  const [adminPendingImages, setAdminPendingImages] = useState<string[]>([]);
  const [adminUploadingImage, setAdminUploadingImage] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const adminChatBottomRef = useRef<HTMLDivElement>(null);
  const [inlineReplies, setInlineReplies] = useState<Record<number, string>>({});
  const [inlineImages, setInlineImages] = useState<Record<number, string[]>>({});
  const [inlineUploadingImage, setInlineUploadingImage] = useState<number | null>(null);
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set());
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const [inlineFileTargetTicket, setInlineFileTargetTicket] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAddLimitModal, setShowAddLimitModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<CityPurchaseLimit | null>(null);
  const [limitForm, setLimitForm] = useState({ cityName: "", minimumAmount: "" });
  const [deleteLimitConfirmOpen, setDeleteLimitConfirmOpen] = useState(false);
  const [limitToDelete, setLimitToDelete] = useState<CityPurchaseLimit | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [clearLogsConfirmOpen, setClearLogsConfirmOpen] = useState(false);

  // Access passwords state
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [editingPassword, setEditingPassword] = useState<AccessPassword | null>(null);
  const [accessForm, setAccessForm] = useState({ label: "", password: "", validFrom: "", validTo: "" });
  const [deletePasswordConfirmOpen, setDeletePasswordConfirmOpen] = useState(false);
  const [passwordToDelete, setPasswordToDelete] = useState<AccessPassword | null>(null);
  const [showAccessPasswordText, setShowAccessPasswordText] = useState(false);

  // Discounts state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [deleteDiscountConfirmOpen, setDeleteDiscountConfirmOpen] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState<Discount | null>(null);
  const [discountForm, setDiscountForm] = useState({
    name: "",
    description: "",
    type: "quantity" as "quantity" | "bundle" | "spend" | "bogo",
    isActive: true,
    minQuantity: "",
    minSpend: "",
    requiredProductSkus: "",
    discountPercent: "",
    freeProductSku: "",
    freeProductQuantity: "1",
    applyToProductSku: "",
    applyToCategoryId: "",
    validFrom: "",
    validTo: "",
  });


  // Grab Bags state
  const [discountsSubTab, setDiscountsSubTab] = useState("promo-codes");
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
  type GrabBagPreview = { selectedProducts: { id: number; name: string; price: number; sku: string; sellingMethod?: string; weightLabel?: string; selectedSize?: string; imageUrl?: string | null; imageUrls?: string | null }[]; retailValue: number; sellingPrice: number; bagId: number; bagName: string; warnings?: string[] };
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

  // Redirect if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/admin/inventory-logs"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory-logs"] });
      setClearLogsConfirmOpen(false);
      toast({ title: "Logs cleared", description: "All stock adjustment logs have been deleted." });
    },
    onError: () => toast({ title: "Error", description: "Failed to clear logs.", variant: "destructive" }),
  });

  const { data: inventoryLogs = [], isLoading } = useQuery<InventoryLogWithDetails[]>({
    queryKey: ["/api/admin/inventory-logs", { days: dateFilter, type: typeFilter, product: productFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter && dateFilter !== 'all') params.append('days', dateFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (productFilter) params.append('product', productFilter);

      const response = await fetch(`/api/admin/inventory-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch inventory logs');
      return response.json();
    }
  });

  // Delivery runs feature toggle
  const { data: deliveryRunsSetting, isLoading: isLoadingDeliveryRuns } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/settings/delivery_runs_enabled"],
  });
  const deliveryRunsEnabled = deliveryRunsSetting?.value !== "false";
  const toggleDeliveryRunsMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PUT", "/api/admin/settings/delivery_runs_enabled", { value: String(enabled) }),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/delivery_runs_enabled"] });
      toast({ title: "Setting saved", description: `Delivery run selection has been ${enabled ? "enabled" : "disabled"}.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" }),
  });

  // Global Weight Pricing toggle
  const { data: globalWeightPricingSetting, isLoading: isLoadingWeightPricing } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/settings/global_weight_pricing_enabled"],
  });
  const globalWeightPricingEnabled = globalWeightPricingSetting?.value !== "false";
  const toggleWeightPricingMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PUT", "/api/admin/settings/global_weight_pricing_enabled", { value: String(enabled) }),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/global_weight_pricing_enabled"] });
      toast({ title: "Setting saved", description: `Global Weight Pricing has been ${enabled ? "enabled" : "disabled"}.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to update setting.", variant: "destructive" }),
  });

  const { data: accessPasswords = [], isLoading: isLoadingPasswords } = useQuery<AccessPassword[]>({
    queryKey: ["/api/admin/access-passwords"],
    queryFn: async () => {
      const res = await fetch("/api/admin/access-passwords", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch access passwords");
      return res.json();
    },
  });

  const createPasswordMutation = useMutation({
    mutationFn: async (data: typeof accessForm) => {
      const res = await apiRequest("POST", "/api/admin/access-passwords", {
        label: data.label,
        password: data.password,
        validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : null,
        validTo: data.validTo ? new Date(data.validTo).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-passwords"] });
      setShowAccessModal(false);
      setAccessForm({ label: "", password: "", validFrom: "", validTo: "" });
      toast({ title: "Access password created" });
    },
    onError: () => toast({ title: "Failed to create access password", variant: "destructive" }),
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof accessForm }) => {
      const res = await apiRequest("PUT", `/api/admin/access-passwords/${id}`, {
        label: data.label,
        password: data.password,
        validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : null,
        validTo: data.validTo ? new Date(data.validTo).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-passwords"] });
      setShowAccessModal(false);
      setEditingPassword(null);
      setAccessForm({ label: "", password: "", validFrom: "", validTo: "" });
      toast({ title: "Access password updated" });
    },
    onError: () => toast({ title: "Failed to update access password", variant: "destructive" }),
  });

  const togglePasswordActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/access-passwords/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/access-passwords"] }),
    onError: () => toast({ title: "Failed to update access password", variant: "destructive" }),
  });

  const deletePasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/access-passwords/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access-passwords"] });
      setDeletePasswordConfirmOpen(false);
      setPasswordToDelete(null);
      toast({ title: "Access password deleted" });
    },
    onError: () => toast({ title: "Failed to delete access password", variant: "destructive" }),
  });

  // Discount queries & mutations
  const { data: allDiscounts = [], isLoading: isLoadingDiscounts } = useQuery<Discount[]>({
    queryKey: ["/api/admin/discounts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/discounts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch discounts");
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery<ProductWithSizes[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const createDiscountMutation = useMutation({
    mutationFn: async (data: typeof discountForm) => {
      const payload: any = {
        name: data.name,
        type: data.type,
        description: data.description || null,
        isActive: data.isActive,
        discountPercent: data.discountPercent || null,
        validFrom: data.validFrom || null,
        validTo: data.validTo || null,
        freeProductQuantity: data.freeProductQuantity ? parseInt(data.freeProductQuantity) : 1,
      };
      if (data.minQuantity) payload.minQuantity = parseInt(data.minQuantity);
      if (data.minSpend) payload.minSpend = data.minSpend;
      if (data.requiredProductSkus) payload.requiredProductSkus = data.requiredProductSkus;
      if (data.freeProductSku) payload.freeProductSku = data.freeProductSku;
      if (data.applyToProductSku) payload.applyToProductSku = data.applyToProductSku;
      if (data.applyToCategoryId) payload.applyToCategoryId = parseInt(data.applyToCategoryId);
      const res = await apiRequest("POST", "/api/admin/discounts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] });
      setShowDiscountModal(false);
      resetDiscountForm();
      toast({ title: "Discount created" });
    },
    onError: () => toast({ title: "Failed to create discount", variant: "destructive" }),
  });

  const updateDiscountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof discountForm }) => {
      const payload: any = {
        name: data.name,
        type: data.type,
        description: data.description || null,
        isActive: data.isActive,
        discountPercent: data.discountPercent || null,
        minQuantity: data.minQuantity ? parseInt(data.minQuantity) : null,
        minSpend: data.minSpend || null,
        requiredProductSkus: data.requiredProductSkus || null,
        freeProductSku: data.freeProductSku || null,
        freeProductQuantity: data.freeProductQuantity ? parseInt(data.freeProductQuantity) : 1,
        applyToProductSku: data.applyToProductSku || null,
        applyToCategoryId: data.applyToCategoryId ? parseInt(data.applyToCategoryId) : null,
        validFrom: data.validFrom || null,
        validTo: data.validTo || null,
      };
      const res = await apiRequest("PUT", `/api/admin/discounts/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] });
      setShowDiscountModal(false);
      setEditingDiscount(null);
      resetDiscountForm();
      toast({ title: "Discount updated" });
    },
    onError: () => toast({ title: "Failed to update discount", variant: "destructive" }),
  });

  const toggleDiscountMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/discounts/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] }),
    onError: () => toast({ title: "Failed to toggle discount", variant: "destructive" }),
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/discounts/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discounts"] });
      setDeleteDiscountConfirmOpen(false);
      setDiscountToDelete(null);
      toast({ title: "Discount deleted" });
    },
    onError: () => toast({ title: "Failed to delete discount", variant: "destructive" }),
  });

  const resetDiscountForm = () => setDiscountForm({
    name: "", description: "", type: "quantity", isActive: true,
    minQuantity: "", minSpend: "", requiredProductSkus: "", discountPercent: "",
    freeProductSku: "", freeProductQuantity: "1", applyToProductSku: "", applyToCategoryId: "",
    validFrom: "", validTo: "",
  });

  // ── Promo Codes ──────────────────────────────────────────────────────────
  const [promoCodeForm, setPromoCodeForm] = useState({
    code: "", description: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
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

  const resetPromoCodeForm = () => setPromoCodeForm({
    code: "", description: "",
    discountType: "percent",
    discountValue: "",
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
      discountType: (p.discountType as "percent" | "fixed") || "percent",
      discountValue: p.discountValue?.toString() || "",
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

  const createPromoCodeMutation = useMutation({
    mutationFn: async (data: typeof promoCodeForm) => {
      const payload: any = {
        code: data.code.toUpperCase().trim(),
        description: data.description || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
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
        discountValue: data.discountValue,
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

  // Grab Bag queries & mutations
  const { data: allGrabBags = [], isLoading: isLoadingGrabBags } = useQuery<GrabBag[]>({
    queryKey: ["/api/admin/grab-bags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/grab-bags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch grab bags");
      return res.json();
    },
  });

  // Generated bag products (live product records with GRAB-BAG-* SKUs)
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

  // Categories that have at least one active, in-stock product
  const categoriesWithStock = useMemo(() => {
    const ids = new Set<number>();
    for (const p of allProducts) {
      if ((p.stock ?? 0) > 0 || ((p as any).physicalInventory ?? 0) > 0) {
        if (p.categoryId) ids.add(p.categoryId);
      }
    }
    return ids;
  }, [allProducts]);

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

  const openEditDiscount = (d: Discount) => {
    setEditingDiscount(d);
    // Convert stored product IDs back to SKUs for display
    const findSku = (id: number | null | undefined) =>
      id ? (allProducts.find(p => p.id === id)?.sku || id.toString()) : "";
    const requiredSkus = (() => {
      if (!d.requiredProductIds) return "";
      try {
        const ids: number[] = JSON.parse(d.requiredProductIds);
        return ids.map(id => allProducts.find(p => p.id === id)?.sku || id.toString()).join(", ");
      } catch { return d.requiredProductIds; }
    })();
    setDiscountForm({
      name: d.name,
      description: d.description || "",
      type: d.type as "quantity" | "bundle" | "spend" | "bogo",
      isActive: d.isActive,
      minQuantity: d.minQuantity?.toString() || "",
      minSpend: d.minSpend?.toString() || "",
      requiredProductSkus: requiredSkus,
      discountPercent: d.discountPercent?.toString() || "",
      freeProductSku: findSku(d.freeProductId),
      freeProductQuantity: d.freeProductQuantity?.toString() || "1",
      applyToProductSku: findSku(d.applyToProductId),
      applyToCategoryId: d.applyToCategoryId?.toString() || "",
      validFrom: d.validFrom ? new Date(d.validFrom).toISOString().slice(0, 10) : "",
      validTo: d.validTo ? new Date(d.validTo).toISOString().slice(0, 10) : "",
    });
    setShowDiscountModal(true);
  };

  const getDiscountTypeIcon = (type: string) => {
    switch(type) {
      case 'quantity': return <ShoppingBag className="h-4 w-4" />;
      case 'bundle': return <Package className="h-4 w-4" />;
      case 'spend': return <DollarSign className="h-4 w-4" />;
      case 'bogo': return <Gift className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const getDiscountTypeLabel = (type: string) => {
    switch(type) {
      case 'quantity': return 'Quantity Discount';
      case 'bundle': return 'Bundle Pack';
      case 'spend': return 'Spend Discount';
      case 'bogo': return 'Buy One Get One';
      default: return type;
    }
  };

  const getDiscountSummary = (d: Discount) => {
    switch(d.type) {
      case 'quantity':
        return `Buy ${d.minQuantity}+ items → ${d.discountPercent}% off`;
      case 'bundle': {
        let ids: number[] = [];
        try { ids = JSON.parse(d.requiredProductIds || '[]'); } catch {}
        const reward = d.freeProductId ? 'free item' : `${d.discountPercent}% off`;
        return `Buy ${ids.length} specific item${ids.length !== 1 ? 's' : ''} → get ${reward}`;
      }
      case 'spend':
        return `Spend $${d.minSpend}+ → ${d.discountPercent}% off`;
      case 'bogo':
        return `Buy one, get one free`;
      default: return '';
    }
  };

  const { data: cityLimits = [], isLoading: isLoadingLimits } = useQuery<CityPurchaseLimit[]>({
    queryKey: ["/api/city-purchase-limits"],
    queryFn: async () => {
      const response = await fetch("/api/city-purchase-limits", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch city purchase limits");
      return response.json();
    },
  });

  const createLimitMutation = useMutation({
    mutationFn: async (data: { cityName: string; minimumAmount: string }) => {
      const response = await fetch("/api/city-purchase-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(result.message || "Failed to create");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-purchase-limits"] });
      setShowAddLimitModal(false);
      setLimitForm({ cityName: "", minimumAmount: "" });
      toast({ title: "City purchase limit created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create city purchase limit", variant: "destructive" });
    },
  });

  const updateLimitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/city-purchase-limits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.message || "Failed to update");
      return result;
    },
    onSuccess: (updatedLimit) => {
      queryClient.setQueryData(["/api/city-purchase-limits"], (old: CityPurchaseLimit[] | undefined) => {
        if (!old) return [updatedLimit];
        return old.map(l => l.id === updatedLimit.id ? updatedLimit : l);
      });
      setEditingLimit(null);
      setLimitForm({ cityName: "", minimumAmount: "" });
      toast({ title: "City purchase limit updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update city purchase limit", variant: "destructive" });
    },
  });

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/city-purchase-limits/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result.message || "Failed to delete");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/city-purchase-limits"] });
      setDeleteLimitConfirmOpen(false);
      setLimitToDelete(null);
      toast({ title: "City purchase limit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete city purchase limit", variant: "destructive" });
    },
  });

  const { data: supportTickets = [], isLoading: isLoadingTickets } = useQuery<SupportTicketWithDetails[]>({
    queryKey: ["/api/support/tickets", { status: ticketStatusFilter, priority: ticketPriorityFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ticketStatusFilter && ticketStatusFilter !== 'all') params.append('status', ticketStatusFilter);
      if (ticketPriorityFilter && ticketPriorityFilter !== 'all') params.append('priority', ticketPriorityFilter);

      const response = await fetch(`/api/support/tickets?${params}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error('Failed to fetch support tickets');
      return response.json();
    },
    refetchInterval: 5000,
  });

  const selectedTicket = useMemo(
    () => supportTickets.find((t: any) => t.ticket.id === selectedTicketId) ?? null,
    [supportTickets, selectedTicketId]
  );

  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: number; status: string }) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update ticket status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update ticket status", variant: "destructive" });
    },
  });



  const sendTicketResponseMutation = useMutation({
    mutationFn: async ({ ticketId, response, type, imageUrls }: { ticketId: number; response: string; type: string; imageUrls?: string[] }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response, type, imageUrls }),
      });
      if (!res.ok) throw new Error('Failed to send response');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Response sent successfully" });
      setTicketResponse("");
      setAdminPendingImages([]);
    },
    onError: () => {
      toast({ title: "Failed to send response", variant: "destructive" });
    },
  });

  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "closed" }),
      });
      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = text ? JSON.parse(text) : { message: 'Failed to close ticket' };
        } catch {
          errorData = { message: text || 'Failed to close ticket' };
        }
        throw new Error(errorData.message || 'Failed to close ticket');
      }
      const text = await response.text();
      if (!text) {
        return { success: true };
      }
      try {
        return JSON.parse(text);
      } catch {
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Support ticket closed successfully. It will be automatically deleted after 24 hours." });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to close support ticket", variant: "destructive" });
    },
  });

  const handleCloseTicket = (item: SupportTicketWithDetails) => {
    closeTicketMutation.mutate(item.ticket.id);
  };

  const archiveTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/archive`, {
        method: "PUT",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to archive ticket");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket archived. It will not be auto-deleted." });
    },
    onError: () => {
      toast({ title: "Failed to archive ticket", variant: "destructive" });
    },
  });

  const unarchiveTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/support/tickets/${ticketId}/unarchive`, {
        method: "PUT",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to unarchive ticket");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket unarchived." });
    },
    onError: () => {
      toast({ title: "Failed to unarchive ticket", variant: "destructive" });
    },
  });

  const clearAllTicketsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/support/tickets", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to clear tickets");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setClearAllConfirmOpen(false);
      toast({ title: "All non-archived tickets cleared." });
    },
    onError: () => {
      toast({ title: "Failed to clear tickets", variant: "destructive" });
    },
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stock_in': return 'bg-green-100 text-green-800';
      case 'stock_out': return 'bg-red-100 text-red-800';
      case 'adjustment': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'stock_in': return 'Stock In';
      case 'stock_out': return 'Stock Out';
      case 'adjustment': return 'Adjustment';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'close_requested': return 'bg-orange-100 text-orange-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpdateTicketStatus = (ticketId: number, status: string) => {
    updateTicketStatusMutation.mutate({ ticketId, status });
  };



  const handleTicketView = (ticket: SupportTicketWithDetails) => {
    setSelectedTicketId(ticket.ticket.id);
    setShowTicketModal(true);
  };

  const handleCloseTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicketId(null);
    setTicketResponse("");
    setAdminPendingImages([]);
  };

  const handleSendResponse = () => {
    if (selectedTicket && (ticketResponse.trim() || adminPendingImages.length > 0)) {
      sendTicketResponseMutation.mutate({
        ticketId: selectedTicket.ticket.id,
        response: ticketResponse.trim() || "(image attached)",
        type: "staff",
        imageUrls: adminPendingImages.length > 0 ? adminPendingImages : undefined,
      });
    }
  };

  const handleAdminImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdminUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/support/ticket-images", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { imageUrl } = await res.json();
      setAdminPendingImages((prev) => [...prev, imageUrl]);
    } catch {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setAdminUploadingImage(false);
      if (adminFileInputRef.current) adminFileInputRef.current.value = "";
    }
  };

  const handleInlineImageUpload = async (ticketId: number, file: File) => {
    setInlineUploadingImage(ticketId);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/support/ticket-images", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { imageUrl } = await res.json();
      setInlineImages((prev) => ({ ...prev, [ticketId]: [...(prev[ticketId] || []), imageUrl] }));
    } catch {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setInlineUploadingImage(null);
      if (inlineFileInputRef.current) inlineFileInputRef.current.value = "";
    }
  };

  const getTicketDisplayStatus = (item: any): { label: string; className: string } => {
    const status = item.ticket.status;
    if (status === 'closed') return { label: 'Resolved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
    if (status === 'close_requested') return { label: 'Close Requested', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
    const hasStaffReply = item.responses?.some((r: any) => r.type === 'staff');
    if (hasStaffReply || status === 'in_progress') return { label: 'Processing', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
    return { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const filteredLogs = inventoryLogs.filter(log => {
    const matchesSearch = productFilter === "" || 
      log.product?.name?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.product?.sku?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.user?.firstName?.toLowerCase().includes(productFilter.toLowerCase()) ||
      log.user?.lastName?.toLowerCase().includes(productFilter.toLowerCase());

    const matchesType = typeFilter === "all" || log.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'product':
        aValue = a.product?.name?.toLowerCase() || '';
        bValue = b.product?.name?.toLowerCase() || '';
        break;
      case 'sku':
        aValue = a.product?.sku?.toLowerCase() || '';
        bValue = b.product?.sku?.toLowerCase() || '';
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      case 'quantity':
        aValue = Math.abs(a.quantity);
        bValue = Math.abs(b.quantity);
        break;
      case 'previousStock':
        aValue = a.previousStock;
        bValue = b.previousStock;
        break;
      case 'newStock':
        aValue = a.newStock;
        bValue = b.newStock;
        break;
      case 'changedBy':
        const aName = a.user?.firstName && a.user?.lastName 
          ? `${a.user.firstName} ${a.user.lastName}`.toLowerCase()
          : a.user?.email?.toLowerCase() || '';
        const bName = b.user?.firstName && b.user?.lastName 
          ? `${b.user.firstName} ${b.user.lastName}`.toLowerCase()
          : b.user?.email?.toLowerCase() || '';
        aValue = aName;
        bValue = bName;
        break;
      case 'reason':
        aValue = a.reason?.toLowerCase() || '';
        bValue = b.reason?.toLowerCase() || '';
        break;
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
        <p className="text-gray-600">Administrative tools and reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex w-full overflow-x-auto h-auto flex-nowrap">
          <TabsTrigger value="support" className="flex-shrink-0 text-xs sm:text-sm">Support Tickets</TabsTrigger>
          <TabsTrigger value="logs" className="flex-shrink-0 text-xs sm:text-sm">Logs</TabsTrigger>
          <TabsTrigger value="purchase-limits" className="flex-shrink-0 text-xs sm:text-sm">Purchase Limits</TabsTrigger>
          <TabsTrigger value="access" className="flex-shrink-0 text-xs sm:text-sm">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          {/* Inventory Changes Section */}
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track all stock adjustments, additions, and removals made to products
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearLogsConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Time Period</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 hours</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Change Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="stock_in">Stock In</SelectItem>
                  <SelectItem value="stock_out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Product Search</label>
              <Input
                placeholder="Search by product name or SKU"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Inventory Logs */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No inventory changes found for the selected filters
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {sortedLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(log.createdAt!), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <Badge className={getTypeColor(log.type)}>
                        {getTypeLabel(log.type)}
                      </Badge>
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {log.product?.name || 'Unknown Product'}
                    </div>
                    {log.product?.sku && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {log.product.sku}</div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                      <span className={`font-medium ${log.type === 'stock_out' ? 'text-red-600 dark:text-red-400' : log.type === 'stock_in' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {log.type === 'stock_out' ? '-' : log.type === 'stock_in' ? '+' : '±'}{log.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Stock</span>
                      <span className="text-gray-900 dark:text-white">{log.previousStock} &rarr; {log.newStock}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Changed By</span>
                      <span className="text-gray-900 dark:text-white">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                      </span>
                    </div>
                    {log.reason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                        {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('createdAt')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Date & Time {getSortIcon('createdAt')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('product')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Product {getSortIcon('product')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('sku')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          SKU {getSortIcon('sku')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('type')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Type {getSortIcon('type')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('quantity')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Quantity {getSortIcon('quantity')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('previousStock')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Previous Stock {getSortIcon('previousStock')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('newStock')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          New Stock {getSortIcon('newStock')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('changedBy')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Changed By {getSortIcon('changedBy')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('reason')} className="h-auto p-0 font-semibold hover:bg-transparent">
                          Reason {getSortIcon('reason')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(new Date(log.createdAt!), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-black dark:text-white">
                            {log.product?.name || 'Unknown Product'}
                          </div>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">
                          {log.product?.sku || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(log.type)}>
                            {getTypeLabel(log.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">
                          <span className={log.type === 'stock_out' ? 'text-red-600 dark:text-red-400' : log.type === 'stock_in' ? 'text-green-600 dark:text-green-400' : ''}>
                            {log.type === 'stock_out' ? '-' : log.type === 'stock_in' ? '+' : '±'}{log.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-black dark:text-white">{log.previousStock}</TableCell>
                        <TableCell className="text-black dark:text-white font-medium">{log.newStock}</TableCell>
                        <TableCell className="text-black dark:text-white">
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                        </TableCell>
                        <TableCell className="text-black dark:text-white max-w-xs truncate">
                          {log.reason || 'No reason provided'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="support">
          {/* Support Tickets Section */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Support Ticket Management
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage customer support tickets and assign them to staff members. Closed tickets auto-delete after 24 hours unless archived.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setClearAllConfirmOpen(true)}
                className="w-full sm:w-auto flex items-center gap-2"
              >
                <Trash className="h-4 w-4" />
                Clear All Tickets
              </Button>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
              </div>

              {/* Support Tickets */}
              {isLoadingTickets ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              ) : supportTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No support tickets found for the selected filters
                </div>
              ) : (
                <>
                  {/* Hidden shared file input for inline image uploads */}
                  <input
                    ref={inlineFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && inlineFileTargetTicket !== null) {
                        handleInlineImageUpload(inlineFileTargetTicket, file);
                      }
                    }}
                  />

                  {/* Ticket Cards */}
                  <div className="space-y-2">
                    {supportTickets.map((item) => {
                      const customerName = item.ticket.customerName || (item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Anonymous');
                      const replyText = inlineReplies[item.ticket.id] || '';
                      const pendingImgs = inlineImages[item.ticket.id] || [];
                      const isExpanded = expandedTickets.has(item.ticket.id);
                      const displayStatus = getTicketDisplayStatus(item);
                      const responseCount = (item.responses?.length || 0);
                      const isClosed = item.ticket.status === 'closed';
                      const ticketNum = (item.ticket as any).weeklyTicketNumber
                        ? `#${String((item.ticket as any).weeklyTicketNumber).padStart(4, '0')}`
                        : `#${String(item.ticket.id).padStart(4, '0')}`;
                      // Unique staff who replied
                      const staffRepliers: string[] = [];
                      (item.responses || []).forEach((r: any) => {
                        if (r.type === 'staff' && r.createdBy) {
                          const name = `${r.createdBy.firstName} ${r.createdBy.lastName}`.trim();
                          if (name && !staffRepliers.includes(name)) staffRepliers.push(name);
                        }
                      });

                      const toggleExpand = () => {
                        setExpandedTickets((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.ticket.id)) next.delete(item.ticket.id);
                          else next.add(item.ticket.id);
                          return next;
                        });
                      };

                      const sendReply = () => {
                        if (!replyText.trim() && pendingImgs.length === 0) return;
                        sendTicketResponseMutation.mutate(
                          {
                            ticketId: item.ticket.id,
                            response: replyText.trim() || "(image attached)",
                            type: 'staff',
                            imageUrls: pendingImgs.length > 0 ? pendingImgs : undefined,
                          },
                          {
                            onSuccess: () => {
                              setInlineReplies((prev) => ({ ...prev, [item.ticket.id]: '' }));
                              setInlineImages((prev) => ({ ...prev, [item.ticket.id]: [] }));
                            },
                          }
                        );
                      };

                      return (
                        <div key={item.ticket.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          {/* Collapsed Header — always visible, click to expand */}
                          <button
                            type="button"
                            onClick={toggleExpand}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                              <div className="min-w-0">
                                {/* Row 1: ticket number + name + status */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{ticketNum}</span>
                                  <span className="font-semibold text-gray-900 dark:text-white">{customerName}</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${displayStatus.className}`}>
                                    {displayStatus.label}
                                  </span>
                                </div>
                                {/* Row 2: subject + date */}
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                  {item.ticket.subject || 'No subject'} · {format(new Date(item.ticket.createdAt!), 'MMM dd, yyyy HH:mm')}
                                </div>
                                {/* Row 3: staff who replied */}
                                {staffRepliers.length > 0 && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs text-gray-400 dark:text-gray-500">Replied by:</span>
                                    {staffRepliers.map((name, i) => (
                                      <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300 font-medium">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                              {!isClosed && (
                                <Button variant="outline" size="sm" onClick={() => handleCloseTicket(item)} className="text-xs">
                                  Close
                                </Button>
                              )}
                              {!item.ticket.archived ? (
                                <Button variant="outline" size="sm" onClick={() => archiveTicketMutation.mutate(item.ticket.id)} disabled={archiveTicketMutation.isPending} className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                                  <Archive className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Archive</span>
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => unarchiveTicketMutation.mutate(item.ticket.id)} disabled={unarchiveTicketMutation.isPending} className="text-xs">
                                  <Archive className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Unarchive</span>
                                </Button>
                              )}
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="p-4 space-y-3 border-t border-gray-100 dark:border-gray-700">
                              {/* Contact info */}
                              {((item.ticket as any).customerTelegram || item.ticket.customerEmail || item.user?.email || item.ticket.customerPhone) && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {(item.ticket as any).customerTelegram
                                    ? <span className="text-blue-500">@{(item.ticket as any).customerTelegram}</span>
                                    : <>{item.ticket.customerEmail || item.user?.email || ''}{item.ticket.customerPhone ? ` · ${item.ticket.customerPhone}` : ''}</>
                                  }
                                </div>
                              )}

                              {/* Original message */}
                              {item.ticket.message && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                    {customerName} · {format(new Date(item.ticket.createdAt!), 'MMM d, h:mm a')}
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                                    {item.ticket.message}
                                  </div>
                                  {(() => { try { const imgs: string[] = (item.ticket as any).imageUrls ? JSON.parse((item.ticket as any).imageUrls) : []; return imgs.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {imgs.map((url: string, i: number) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer">
                                          <img src={url} alt="attachment" className="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity" />
                                        </a>
                                      ))}
                                    </div>
                                  ) : null; } catch { return null; } })()}
                                </div>
                              )}

                              {/* Responses */}
                              {item.responses?.map((response: any) => {
                                const isStaff = response.type === 'staff';
                                const senderName = isStaff
                                  ? (response.createdBy ? `${response.createdBy.firstName} ${response.createdBy.lastName}` : 'Staff')
                                  : customerName;
                                const imgs: string[] = (() => { try { return response.imageUrls ? JSON.parse(response.imageUrls) : []; } catch { return []; } })();
                                return (
                                  <div key={response.id} className={isStaff ? 'pl-6' : ''}>
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                      {senderName} · {format(new Date(response.createdAt), 'MMM d, h:mm a')}
                                    </div>
                                    <div className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${isStaff ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-900 dark:text-blue-100' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                                      {response.message}
                                    </div>
                                    {imgs.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {imgs.map((url: string, i: number) => (
                                          <img key={i} src={url} alt="attachment" className="h-20 w-20 object-cover rounded border cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Inline reply box */}
                              {!isClosed && !item.ticket.subject?.includes('Password Reset Request') && (
                                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                  {/* Pending images preview */}
                                  {pendingImgs.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {pendingImgs.map((url, i) => (
                                        <div key={i} className="relative">
                                          <img src={url} alt="pending" className="h-16 w-16 object-cover rounded border" />
                                          <button
                                            type="button"
                                            onClick={() => setInlineImages((prev) => ({ ...prev, [item.ticket.id]: prev[item.ticket.id].filter((_, idx) => idx !== i) }))}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                          >×</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-2 items-end">
                                    <Textarea
                                      placeholder="Type a reply… (Ctrl+Enter to send)"
                                      value={replyText}
                                      onChange={(e) => setInlineReplies((prev) => ({ ...prev, [item.ticket.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (replyText.trim() || pendingImgs.length > 0)) sendReply();
                                      }}
                                      rows={2}
                                      className="flex-1 text-sm resize-none"
                                    />
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        disabled={inlineUploadingImage === item.ticket.id}
                                        onClick={() => {
                                          setInlineFileTargetTicket(item.ticket.id);
                                          setTimeout(() => inlineFileInputRef.current?.click(), 0);
                                        }}
                                        title="Attach photo"
                                      >
                                        {inlineUploadingImage === item.ticket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={(!replyText.trim() && pendingImgs.length === 0) || sendTicketResponseMutation.isPending}
                                        onClick={sendReply}
                                      >
                                        {sendTicketResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-limits">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  City Purchase Limits
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Set minimum order amounts for specific cities. Users shipping to these cities must meet the minimum purchase amount.
                </p>
              </div>
              <Button onClick={() => {
                setLimitForm({ cityName: "", minimumAmount: "" });
                setEditingLimit(null);
                setShowAddLimitModal(true);
              }} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Add City Limit
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingLimits ? (
                <p className="text-center text-gray-500 py-4">Loading...</p>
              ) : cityLimits.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No city purchase limits configured yet. Add one to get started.</p>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {cityLimits.map((limit: CityPurchaseLimit) => (
                      <div key={limit.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-base">
                              {limit.cityName}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-sm text-gray-600 dark:text-gray-400">
                              <DollarSign className="h-3 w-3" />
                              <span>Minimum: ${parseFloat(limit.minimumAmount).toFixed(2)}</span>
                            </div>
                          </div>
                          <Badge variant={limit.isActive ? "default" : "secondary"}>
                            {limit.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <Button
                            variant={(limit as any).deliveryBlocked ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => {
                              updateLimitMutation.mutate({
                                id: limit.id,
                                data: { deliveryBlocked: !(limit as any).deliveryBlocked },
                              });
                            }}
                            className={`w-full text-xs ${!(limit as any).deliveryBlocked ? "border-orange-500 text-orange-500 hover:text-orange-600 hover:border-orange-600" : ""}`}
                          >
                            <TruckIcon className="h-3 w-3 mr-1" />
                            {(limit as any).deliveryBlocked ? "Unblock Delivery" : "Block Delivery"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateLimitMutation.mutate({
                                id: limit.id,
                                data: { isActive: !limit.isActive },
                              });
                            }}
                            className="w-full text-xs"
                          >
                            {limit.isActive ? "Disable" : "Enable"}
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingLimit(limit);
                                setLimitForm({
                                  cityName: limit.cityName,
                                  minimumAmount: limit.minimumAmount,
                                });
                                setShowAddLimitModal(true);
                              }}
                              className="flex-1"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setLimitToDelete(limit);
                                setDeleteLimitConfirmOpen(true);
                              }}
                              className="flex-1"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">City</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Minimum Amount</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Status</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {cityLimits.map((limit: CityPurchaseLimit) => (
                          <tr key={limit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-3 text-sm font-medium">{limit.cityName}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {parseFloat(limit.minimumAmount).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={limit.isActive ? "default" : "secondary"}>
                                {limit.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant={(limit as any).deliveryBlocked ? "destructive" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    updateLimitMutation.mutate({
                                      id: limit.id,
                                      data: { deliveryBlocked: !(limit as any).deliveryBlocked },
                                    });
                                  }}
                                  className={!(limit as any).deliveryBlocked ? "border-orange-500 text-orange-500 hover:text-orange-600 hover:border-orange-600" : ""}
                                >
                                  <TruckIcon className="h-3 w-3 mr-1" />
                                  {(limit as any).deliveryBlocked ? "Unblock" : "Block Delivery"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    updateLimitMutation.mutate({
                                      id: limit.id,
                                      data: { isActive: !limit.isActive },
                                    });
                                  }}
                                >
                                  {limit.isActive ? "Disable" : "Enable"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingLimit(limit);
                                    setLimitForm({
                                      cityName: limit.cityName,
                                      minimumAmount: limit.minimumAmount,
                                    });
                                    setShowAddLimitModal(true);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setLimitToDelete(limit);
                                    setDeleteLimitConfirmOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Passwords Tab */}
        <TabsContent value="access">
          {/* Delivery Runs Feature Toggle */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TruckIcon className="h-4 w-4" />
                Delivery Run Selection
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                When enabled, customers can choose between 1st Run and 2nd Run at checkout.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show delivery run options at checkout</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Customers see 1st Run / 2nd Run selector on the confirm order screen.</p>
                </div>
                {isLoadingDeliveryRuns ? (
                  <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ) : (
                  <Switch
                    checked={deliveryRunsEnabled}
                    onCheckedChange={(val) => toggleDeliveryRunsMutation.mutate(val)}
                    disabled={toggleDeliveryRunsMutation.isPending}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Access Passwords
                  </CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Manage passwords required for customer login. Customers must enter a valid password before accessing the store.
                  </p>
                </div>
                <Button onClick={() => {
                  setEditingPassword(null);
                  setAccessForm({ label: "", password: "", validFrom: "", validTo: "" });
                  setShowAccessModal(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Password
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPasswords ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  ))}
                </div>
              ) : accessPasswords.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No access passwords set</p>
                  <p className="text-sm mt-1">Add a password so customers can access the store.</p>
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3">
                    {accessPasswords.map((ap) => (
                      <div key={ap.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{ap.label}</span>
                          <Badge variant={ap.isActive ? "default" : "secondary"}>
                            {ap.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          ••••••••
                        </div>
                        {(ap.validFrom || ap.validTo) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {ap.validFrom ? format(new Date(ap.validFrom), 'MMM dd, yyyy') : 'Any time'} → {ap.validTo ? format(new Date(ap.validTo), 'MMM dd, yyyy') : 'No expiry'}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                            togglePasswordActiveMutation.mutate({ id: ap.id, isActive: !ap.isActive });
                          }}>
                            {ap.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setEditingPassword(ap);
                            setAccessForm({
                              label: ap.label,
                              password: ap.password,
                              validFrom: ap.validFrom ? toLocalDateTimeString(new Date(ap.validFrom)) : "",
                              validTo: ap.validTo ? toLocalDateTimeString(new Date(ap.validTo)) : "",
                            });
                            setShowAccessModal(true);
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => {
                            setPasswordToDelete(ap);
                            setDeletePasswordConfirmOpen(true);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Label</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Password</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Valid Period</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Status</th>
                          <th className="text-right px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {accessPasswords.map((ap) => (
                          <tr key={ap.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-3 text-sm font-medium">{ap.label}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
                              {ap.password}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {ap.validFrom || ap.validTo ? (
                                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                  <Calendar className="h-3 w-3" />
                                  {ap.validFrom ? format(new Date(ap.validFrom), 'MMM dd, yyyy HH:mm') : 'Any'} – {ap.validTo ? format(new Date(ap.validTo), 'MMM dd, yyyy HH:mm') : 'No expiry'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">Always valid</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={ap.isActive ? "default" : "secondary"}>
                                {ap.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => {
                                  togglePasswordActiveMutation.mutate({ id: ap.id, isActive: !ap.isActive });
                                }}>
                                  {ap.isActive ? "Disable" : "Enable"}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => {
                                  setEditingPassword(ap);
                                  setAccessForm({
                                    label: ap.label,
                                    password: ap.password,
                                    validFrom: ap.validFrom ? toLocalDateTimeString(new Date(ap.validFrom)) : "",
                                    validTo: ap.validTo ? toLocalDateTimeString(new Date(ap.validTo)) : "",
                                  });
                                  setShowAccessModal(true);
                                }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => {
                                  setPasswordToDelete(ap);
                                  setDeletePasswordConfirmOpen(true);
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Add/Edit Discount Dialog */}
      <Dialog open={showDiscountModal} onOpenChange={(open) => { setShowDiscountModal(open); if (!open) { setEditingDiscount(null); resetDiscountForm(); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDiscount ? "Edit" : "New"} Discount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. 4-for-25% Deal" value={discountForm.name} onChange={e => setDiscountForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input placeholder="Short description shown to staff" value={discountForm.description} onChange={e => setDiscountForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Discount Type *</Label>
              <Select value={discountForm.type} onValueChange={(v) => setDiscountForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantity">Quantity Discount – Buy X+ items → % off</SelectItem>
                  <SelectItem value="bundle">Bundle Pack – Specific items together → free item or % off</SelectItem>
                  <SelectItem value="spend">Spend Discount – Spend $X+ → % off</SelectItem>
                  <SelectItem value="bogo">BOGO – Buy one, get one free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type-specific fields */}
            {discountForm.type === 'quantity' && (
              <>
                <div className="space-y-2">
                  <Label>Minimum Items in Cart *</Label>
                  <Input type="number" min="1" placeholder="e.g. 4" value={discountForm.minQuantity} onChange={e => setDiscountForm(f => ({ ...f, minQuantity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Discount Percentage *</Label>
                  <Input type="number" min="1" max="100" placeholder="e.g. 25" value={discountForm.discountPercent} onChange={e => setDiscountForm(f => ({ ...f, discountPercent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Limit to Product SKU (optional – leave blank for any product)</Label>
                  <Input type="text" placeholder="e.g. PROD-001" value={discountForm.applyToProductSku} onChange={e => setDiscountForm(f => ({ ...f, applyToProductSku: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Limit to Category ID (optional)</Label>
                  <Input type="number" placeholder="Category ID" value={discountForm.applyToCategoryId} onChange={e => setDiscountForm(f => ({ ...f, applyToCategoryId: e.target.value }))} />
                </div>
              </>
            )}

            {discountForm.type === 'bundle' && (
              <>
                <div className="space-y-2">
                  <Label>Required Product SKUs (comma-separated) *</Label>
                  <Input placeholder="e.g. PROD-001, PROD-005, PROD-012" value={discountForm.requiredProductSkus} onChange={e => setDiscountForm(f => ({ ...f, requiredProductSkus: e.target.value }))} />
                  <p className="text-xs text-gray-400">Enter the SKUs of products that must all be in the cart to trigger this deal.</p>
                </div>
                <div className="space-y-2">
                  <Label>Free Product SKU (leave blank to give % off instead)</Label>
                  <Input type="text" placeholder="SKU of product to give for free" value={discountForm.freeProductSku} onChange={e => setDiscountForm(f => ({ ...f, freeProductSku: e.target.value }))} />
                </div>
                {discountForm.freeProductSku && (
                  <div className="space-y-2">
                    <Label>Free Product Quantity</Label>
                    <Input type="number" min="1" placeholder="1" value={discountForm.freeProductQuantity} onChange={e => setDiscountForm(f => ({ ...f, freeProductQuantity: e.target.value }))} />
                  </div>
                )}
                {!discountForm.freeProductSku && (
                  <div className="space-y-2">
                    <Label>Discount Percentage (if no free product) *</Label>
                    <Input type="number" min="1" max="100" placeholder="e.g. 15" value={discountForm.discountPercent} onChange={e => setDiscountForm(f => ({ ...f, discountPercent: e.target.value }))} />
                  </div>
                )}
              </>
            )}

            {discountForm.type === 'spend' && (
              <>
                <div className="space-y-2">
                  <Label>Minimum Spend ($) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 100.00" value={discountForm.minSpend} onChange={e => setDiscountForm(f => ({ ...f, minSpend: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Discount Percentage *</Label>
                  <Input type="number" min="1" max="100" placeholder="e.g. 10" value={discountForm.discountPercent} onChange={e => setDiscountForm(f => ({ ...f, discountPercent: e.target.value }))} />
                </div>
              </>
            )}

            {discountForm.type === 'bogo' && (
              <div className="space-y-2">
                <Label>Limit to Product SKU (optional – leave blank for any product)</Label>
                <Input type="text" placeholder="e.g. PROD-001" value={discountForm.applyToProductSku} onChange={e => setDiscountForm(f => ({ ...f, applyToProductSku: e.target.value }))} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valid From (optional)</Label>
                <Input type="date" value={discountForm.validFrom} onChange={e => setDiscountForm(f => ({ ...f, validFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input type="date" value={discountForm.validTo} onChange={e => setDiscountForm(f => ({ ...f, validTo: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={discountForm.isActive} onCheckedChange={(v) => setDiscountForm(f => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDiscountModal(false); setEditingDiscount(null); resetDiscountForm(); }}>Cancel</Button>
            <Button
              disabled={!discountForm.name || createDiscountMutation.isPending || updateDiscountMutation.isPending}
              onClick={() => {
                if (editingDiscount) {
                  updateDiscountMutation.mutate({ id: editingDiscount.id, data: discountForm });
                } else {
                  createDiscountMutation.mutate(discountForm);
                }
              }}
            >
              {(createDiscountMutation.isPending || updateDiscountMutation.isPending) ? "Saving..." : editingDiscount ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Discount Confirmation */}
      <Dialog open={deleteDiscountConfirmOpen} onOpenChange={setDeleteDiscountConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Discount</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>"{discountToDelete?.name}"</strong>? This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDiscountConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (discountToDelete) deleteDiscountMutation.mutate(discountToDelete.id); }} disabled={deleteDiscountMutation.isPending}>
              {deleteDiscountMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit City Purchase Limit Dialog */}
      <Dialog open={showAddLimitModal} onOpenChange={(open) => {
        setShowAddLimitModal(open);
        if (!open) {
          setEditingLimit(null);
          setLimitForm({ cityName: "", minimumAmount: "" });
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingLimit ? "Edit" : "Add"} City Purchase Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>City Name</Label>
              <Input
                placeholder="Enter city name"
                value={limitForm.cityName}
                onChange={(e) => setLimitForm({ ...limitForm, cityName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Order Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={limitForm.minimumAmount}
                onChange={(e) => setLimitForm({ ...limitForm, minimumAmount: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddLimitModal(false);
              setEditingLimit(null);
              setLimitForm({ cityName: "", minimumAmount: "" });
            }}>
              Cancel
            </Button>
            <Button
              disabled={!limitForm.cityName || !limitForm.minimumAmount || createLimitMutation.isPending || updateLimitMutation.isPending}
              onClick={() => {
                if (editingLimit) {
                  updateLimitMutation.mutate({
                    id: editingLimit.id,
                    data: {
                      cityName: limitForm.cityName,
                      minimumAmount: limitForm.minimumAmount,
                    },
                  });
                } else {
                  createLimitMutation.mutate({
                    cityName: limitForm.cityName,
                    minimumAmount: limitForm.minimumAmount,
                  });
                }
              }}
            >
              {(createLimitMutation.isPending || updateLimitMutation.isPending) ? "Saving..." : editingLimit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Limit Confirmation Dialog */}
      <Dialog open={deleteLimitConfirmOpen} onOpenChange={setDeleteLimitConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete City Purchase Limit</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete the purchase limit for <strong>{limitToDelete?.cityName}</strong>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLimitConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (limitToDelete) deleteLimitMutation.mutate(limitToDelete.id);
            }} disabled={deleteLimitMutation.isPending}>
              {deleteLimitMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Ticket Conversation Modal */}
      <Dialog open={showTicketModal} onOpenChange={handleCloseTicketModal}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span>Ticket #{selectedTicket?.ticket.id}</span>
              {selectedTicket && (
                <Badge className={getStatusColor(selectedTicket.ticket.status)}>
                  {selectedTicket.ticket.status === 'in_progress' ? 'In Progress' : selectedTicket.ticket.status === 'close_requested' ? 'Close Requested' : selectedTicket.ticket.status.charAt(0).toUpperCase() + selectedTicket.ticket.status.slice(1)}
                </Badge>
              )}
            </DialogTitle>
            <div className="text-sm text-muted-foreground space-y-1 mt-1">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <span className="font-medium">{selectedTicket?.ticket.customerName || (selectedTicket?.user ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName}` : 'Anonymous')}</span>
                {selectedTicket?.ticket.customerEmail && <span className="text-muted-foreground">· {selectedTicket.ticket.customerEmail}</span>}
                {(selectedTicket?.ticket as any)?.customerTelegram && <span className="text-blue-500">· @{(selectedTicket?.ticket as any)?.customerTelegram}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedTicket?.ticket.subject}</span>
                <span>·</span>
                <Badge className={getPriorityColor(selectedTicket?.ticket.priority || 'normal')}>
                  {(selectedTicket?.ticket.priority || 'normal').charAt(0).toUpperCase() + (selectedTicket?.ticket.priority || 'normal').slice(1)}
                </Badge>
                <span>·</span>
                <span>{selectedTicket?.ticket.createdAt ? format(new Date(selectedTicket.ticket.createdAt), 'MMM d, yyyy') : ''}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Conversation thread */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[220px] max-h-[380px]">
            {/* Original message */}
            {selectedTicket && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                    {selectedTicket.ticket.customerName || 'Customer'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{selectedTicket.ticket.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedTicket.ticket.createdAt ? format(new Date(selectedTicket.ticket.createdAt), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Responses */}
            {selectedTicket?.responses?.map((r: SupportTicketResponse) => {
              const isStaff = r.type === 'staff' || r.type === 'customer_response';
              const isCustomer = r.type === 'customer';
              const images: string[] = r.imageUrls ? (() => { try { return JSON.parse(r.imageUrls); } catch { return []; } })() : [];
              return (
                <div key={r.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-2 ${
                    isStaff
                      ? 'bg-green-600 text-white rounded-tr-sm'
                      : isCustomer
                      ? 'bg-muted rounded-tl-sm'
                      : 'bg-muted italic text-muted-foreground rounded-tl-sm text-sm'
                  }`}>
                    {isStaff && (
                      <p className="text-xs font-semibold text-green-100 mb-1">
                        Support: {r.createdBy ? `${r.createdBy.firstName || ''} ${r.createdBy.lastName || ''}`.trim() || 'Staff' : 'Staff'}
                      </p>
                    )}
                    {isCustomer && (
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                        {selectedTicket.ticket.customerName || 'Customer'}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{r.message}</p>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {images.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="attachment" className="max-h-36 rounded-lg border border-white/20 object-cover cursor-pointer hover:opacity-90" />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${isStaff ? 'text-green-100' : 'text-muted-foreground'}`}>
                      {r.createdAt ? format(new Date(r.createdAt), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={adminChatBottomRef} />
          </div>

          {/* Reply area */}
          {selectedTicket?.ticket.status !== 'closed' && !selectedTicket?.ticket.subject?.includes('Password Reset Request') && (
            <div className="shrink-0 border-t border-border pt-3 space-y-2">
              {adminPendingImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {adminPendingImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="pending" className="h-14 w-14 object-cover rounded-lg border" />
                      <button
                        onClick={() => setAdminPendingImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Textarea
                placeholder="Type your reply to the customer..."
                value={ticketResponse}
                onChange={(e) => setTicketResponse(e.target.value)}
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && (ticketResponse.trim() || adminPendingImages.length > 0)) {
                    handleSendResponse();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <input ref={adminFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAdminImageUpload} />
                  <Button type="button" variant="outline" size="sm" onClick={() => adminFileInputRef.current?.click()} disabled={adminUploadingImage}>
                    {adminUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="ml-1">Photo</span>
                  </Button>
                  {selectedTicket?.ticket.status !== 'closed' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCloseTicket(selectedTicket)}
                      disabled={closeTicketMutation.isPending}
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Close Ticket
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCloseTicketModal}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={handleSendResponse}
                    disabled={(!ticketResponse.trim() && adminPendingImages.length === 0) || sendTicketResponseMutation.isPending}
                  >
                    {sendTicketResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Send
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ctrl+Enter to send</p>
            </div>
          )}
          {selectedTicket?.ticket.status === 'closed' && (
            <div className="shrink-0 border-t border-border pt-3 text-center text-sm text-muted-foreground">
              This ticket is closed.
              <Button variant="outline" size="sm" className="ml-3" onClick={handleCloseTicketModal}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear All Tickets Confirmation Dialog */}
      <Dialog open={clearAllConfirmOpen} onOpenChange={setClearAllConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Support Tickets</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete all <strong>closed</strong> support tickets that are not archived. Open or in-progress tickets will not be affected. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearAllConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearAllTicketsMutation.mutate()}
              disabled={clearAllTicketsMutation.isPending}
            >
              {clearAllTicketsMutation.isPending ? "Clearing..." : "Clear All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clear Inventory Logs Confirmation Dialog */}
      <Dialog open={clearLogsConfirmOpen} onOpenChange={setClearLogsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Stock Adjustment Logs</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will permanently delete <strong>all</strong> stock adjustment log entries. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearLogsConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
            >
              {clearLogsMutation.isPending ? "Clearing..." : "Clear All Logs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Access Password Dialog */}
      <Dialog open={showAccessModal} onOpenChange={(open) => {
        setShowAccessModal(open);
        if (!open) {
          setEditingPassword(null);
          setAccessForm({ label: "", password: "", validFrom: "", validTo: "" });
          setShowAccessPasswordText(false);
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPassword ? "Edit" : "Add"} Access Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Summer 2025, VIP Access"
                value={accessForm.label}
                onChange={(e) => setAccessForm({ ...accessForm, label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showAccessPasswordText ? "text" : "password"}
                  placeholder="Enter access password"
                  value={accessForm.password}
                  onChange={(e) => setAccessForm({ ...accessForm, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => setShowAccessPasswordText(!showAccessPasswordText)}
                  tabIndex={-1}
                >
                  {showAccessPasswordText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From (optional)</Label>
                <Input
                  type="datetime-local"
                  value={accessForm.validFrom}
                  onChange={(e) => setAccessForm({ ...accessForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid To (optional)</Label>
                <Input
                  type="datetime-local"
                  value={accessForm.validTo}
                  onChange={(e) => setAccessForm({ ...accessForm, validTo: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Leave date fields empty for a password that never expires.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAccessModal(false);
              setEditingPassword(null);
              setAccessForm({ label: "", password: "", validFrom: "", validTo: "" });
              setShowAccessPasswordText(false);
            }}>
              Cancel
            </Button>
            <Button
              disabled={!accessForm.label || !accessForm.password || createPasswordMutation.isPending || updatePasswordMutation.isPending}
              onClick={() => {
                if (editingPassword) {
                  updatePasswordMutation.mutate({ id: editingPassword.id, data: accessForm });
                } else {
                  createPasswordMutation.mutate(accessForm);
                }
              }}
            >
              {(createPasswordMutation.isPending || updatePasswordMutation.isPending) ? "Saving..." : editingPassword ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Access Password Confirmation */}
      <Dialog open={deletePasswordConfirmOpen} onOpenChange={setDeletePasswordConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Access Password</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>"{passwordToDelete?.label}"</strong>? Customers using this password will lose access immediately.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePasswordConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (passwordToDelete) deletePasswordMutation.mutate(passwordToDelete.id);
            }} disabled={deletePasswordMutation.isPending}>
              {deletePasswordMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}