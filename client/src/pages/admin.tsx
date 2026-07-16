import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { MessageCircle, User as UserIcon, Clock, AlertTriangle, Eye, Send, ArrowUpDown, ArrowUp, ArrowDown, Trash2, MapPin, Plus, DollarSign, Pencil, TruckIcon, Archive, Trash, KeyRound, Calendar, Eye as EyeIcon, EyeOff, Tag, Percent, Package, ShoppingBag, Gift } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { InventoryLog, Product, User, SupportTicket, CityPurchaseLimit, AccessPassword, Discount, PromoCode, GrabBag, Category } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

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

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("support");
  const [dateFilter, setDateFilter] = useState("7"); // days
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketResponse, setTicketResponse] = useState("");
  const [responseType, setResponseType] = useState("customer_response");
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
  const [showGrabBagModal, setShowGrabBagModal] = useState(false);
  const [editingGrabBag, setEditingGrabBag] = useState<GrabBag | null>(null);
  const [grabBagToDelete, setGrabBagToDelete] = useState<GrabBag | null>(null);
  const [deleteGrabBagConfirmOpen, setDeleteGrabBagConfirmOpen] = useState(false);
  const [grabBagToGenerate, setGrabBagToGenerate] = useState<GrabBag | null>(null);
  const [generateResultOpen, setGenerateResultOpen] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ product: Product; selectedProducts: { name: string; price: number }[]; retailValue: number; sellingPrice: number } | null>(null);
  const [grabBagForm, setGrabBagForm] = useState({
    name: "",
    description: "",
    sellingPrice: "",
    maxTotalItemPrice: "",
    specificProductIds: [] as number[],
    categorySelections: [] as { categoryId: number; count: number }[],
    isActive: true,
  });

  const resetGrabBagForm = () => setGrabBagForm({
    name: "", description: "", sellingPrice: "", maxTotalItemPrice: "",
    specificProductIds: [], categorySelections: [], isActive: true,
  });

  const openEditGrabBag = (g: GrabBag) => {
    setEditingGrabBag(g);
    setGrabBagForm({
      name: g.name,
      description: g.description || "",
      sellingPrice: g.sellingPrice?.toString() || "",
      maxTotalItemPrice: g.maxTotalItemPrice?.toString() || "",
      specificProductIds: g.specificProductIds ? JSON.parse(g.specificProductIds) : [],
      categorySelections: g.categorySelections ? JSON.parse(g.categorySelections) : [],
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

  const { data: allProducts = [] } = useQuery<Product[]>({
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

  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const createGrabBagMutation = useMutation({
    mutationFn: async (data: typeof grabBagForm) => {
      const res = await apiRequest("POST", "/api/admin/grab-bags", {
        name: data.name,
        description: data.description || null,
        sellingPrice: data.sellingPrice,
        maxTotalItemPrice: data.maxTotalItemPrice,
        specificProductIds: data.specificProductIds.length > 0 ? JSON.stringify(data.specificProductIds) : null,
        categorySelections: data.categorySelections.length > 0 ? JSON.stringify(data.categorySelections) : null,
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
      const res = await apiRequest("PUT", `/api/admin/grab-bags/${id}`, {
        name: data.name,
        description: data.description || null,
        sellingPrice: data.sellingPrice,
        maxTotalItemPrice: data.maxTotalItemPrice,
        specificProductIds: data.specificProductIds.length > 0 ? JSON.stringify(data.specificProductIds) : null,
        categorySelections: data.categorySelections.length > 0 ? JSON.stringify(data.categorySelections) : null,
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

  const generateGrabBagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/grab-bags/${id}/generate`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setGenerateResult(data);
      setGenerateResultOpen(true);
      toast({ title: "Grab bag generated!", description: `Product "${data.product.name}" has been added to your catalog.` });
    },
    onError: (e: any) => toast({ title: e.message || "Failed to generate grab bag", variant: "destructive" }),
  });

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
    }
  });



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
    mutationFn: async ({ ticketId, response, type }: { ticketId: number; response: string; type: string }) => {
      const res = await fetch(`/api/support/tickets/${ticketId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response, type }),
      });
      if (!res.ok) throw new Error('Failed to send response');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Response sent successfully" });
      setShowTicketModal(false);
      setTicketResponse("");
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
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpdateTicketStatus = (ticketId: number, status: string) => {
    updateTicketStatusMutation.mutate({ ticketId, status });
  };



  const handleTicketView = (ticket: SupportTicketWithDetails) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
  };

  const handleCloseTicketModal = () => {
    setShowTicketModal(false);
    setSelectedTicket(null);
    setTicketResponse("");
  };

  const handleSendResponse = () => {
    if (selectedTicket && ticketResponse) {
      sendTicketResponseMutation.mutate({
        ticketId: selectedTicket.ticket.id,
        response: ticketResponse,
        type: responseType,
      });
    }
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="support">Support Tickets</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="purchase-limits">Purchase Limits</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
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
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {supportTickets.map((item) => (
                      <div key={item.ticket.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.ticket.customerName || (item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Anonymous')}
                            </div>
                            {(item.ticket as any).customerTelegram ? (
                              <div className="text-sm text-blue-500 dark:text-blue-400">
                                @{(item.ticket as any).customerTelegram}
                              </div>
                            ) : (
                              <>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {item.ticket.customerEmail || item.user?.email || 'No email'}
                                </div>
                                {item.ticket.customerPhone && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {item.ticket.customerPhone}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <Badge className={getStatusColor(item.ticket.status)}>
                            {item.ticket.status === 'in_progress' ? 'In Progress' : item.ticket.status === 'closed' ? 'Closed' : item.ticket.status.charAt(0).toUpperCase() + item.ticket.status.slice(1)}
                          </Badge>
                        </div>
                        {item.ticket.message && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{item.ticket.message}</div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(item.ticket.createdAt!), 'MMM dd, yyyy HH:mm')}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          {item.ticket.status !== 'closed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCloseTicket(item)}
                              className="text-xs"
                            >
                              Close
                            </Button>
                          )}
                          {!item.ticket.archived && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => archiveTicketMutation.mutate(item.ticket.id)}
                              disabled={archiveTicketMutation.isPending}
                              className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            >
                              <Archive className="h-3 w-3 mr-1" />
                              Archive
                            </Button>
                          )}
                          {item.ticket.archived && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unarchiveTicketMutation.mutate(item.ticket.id)}
                              disabled={unarchiveTicketMutation.isPending}
                              className="text-xs text-gray-600 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <Archive className="h-3 w-3 mr-1" />
                              Unarchive
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Card View */}
                  <div className="hidden md:block space-y-4">
                    {supportTickets.map((item) => (
                      <div key={item.ticket.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <UserIcon className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white text-lg">
                                  {item.ticket.customerName || (item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Anonymous')}
                                </div>
                                {(item.ticket as any).customerTelegram ? (
                                  <div className="text-sm text-blue-500 dark:text-blue-400">
                                    @{(item.ticket as any).customerTelegram}
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {item.ticket.customerEmail || item.user?.email || 'No email'}
                                    </div>
                                    {item.ticket.customerPhone && (
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {item.ticket.customerPhone}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Created: {format(new Date(item.ticket.createdAt!), 'MMM dd, yyyy HH:mm')}
                            </div>
                            {item.ticket.status === 'closed' && (
                              <Badge className={getStatusColor(item.ticket.status)}>
                                Closed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {item.ticket.status !== 'closed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCloseTicket(item)}
                                className="text-xs"
                              >
                                Close
                              </Button>
                            )}
                            {!item.ticket.archived && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => archiveTicketMutation.mutate(item.ticket.id)}
                                disabled={archiveTicketMutation.isPending}
                                className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Archive
                              </Button>
                            )}
                            {item.ticket.archived && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => unarchiveTicketMutation.mutate(item.ticket.id)}
                                disabled={unarchiveTicketMutation.isPending}
                                className="text-xs text-gray-600 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Unarchive
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Ticket Message */}
                        {item.ticket.message && (
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Original Message:</span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                              {item.ticket.message}
                            </p>
                          </div>
                        )}

                        {/* Ticket Responses */}
                        {item.responses && item.responses.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Responses ({item.responses.length}):
                            </div>
                            <div className="space-y-2">
                              {item.responses.map((response) => (
                                <div key={response.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                        {response.type === 'staff' ? 'Staff' : response.type === 'customer' ? 'Customer' : 'System'}
                                      </span>
                                      {response.createdBy && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          by {response.createdBy.firstName} {response.createdBy.lastName}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {format(new Date(response.createdAt), 'MMM dd, yyyy HH:mm')}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                                    {response.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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

        {/* Discounts Tab — inner tabs: Promo Codes / Bags */}
        <TabsContent value="discounts">
          <Tabs value={discountsSubTab} onValueChange={setDiscountsSubTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="promo-codes">Promo Codes</TabsTrigger>
              <TabsTrigger value="bags">Bags</TabsTrigger>
            </TabsList>

            {/* ── Promo Codes sub-tab ── */}
            <TabsContent value="promo-codes">
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
                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-2 rounded-md ${p.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                              <Tag className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold tracking-wider text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{p.code}</span>
                                <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">{p.isActive ? 'Active' : 'Inactive'}</Badge>
                                <Badge variant="outline" className="text-xs">
                                  {p.discountType === 'percent' ? `${p.discountValue}% off` : `$${Number(p.discountValue).toFixed(2)} off`}
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
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Bags sub-tab ── */}
            <TabsContent value="bags">
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
                              <div className={`mt-0.5 p-2 rounded-md shrink-0 ${bag.isActive ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                                <ShoppingBag className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">{bag.name}</span>
                                  <Badge variant={bag.isActive ? "default" : "secondary"} className="text-xs">{bag.isActive ? 'Active' : 'Inactive'}</Badge>
                                  <Badge variant="outline" className="text-xs text-green-700 border-green-400 dark:text-green-400">Sells for ${Number(bag.sellingPrice).toFixed(2)}</Badge>
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Max value ${Number(bag.maxTotalItemPrice).toFixed(2)}</Badge>
                                </div>
                                {bag.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{bag.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                                  {specificIds.length > 0 && (
                                    <span>{specificIds.length} specific item{specificIds.length !== 1 ? 's' : ''}</span>
                                  )}
                                  {catSels.length > 0 && (
                                    <span>{catSels.reduce((s, c) => s + c.count, 0)} random from {catSels.length} categor{catSels.length !== 1 ? 'ies' : 'y'}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-purple-600 border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                onClick={() => generateGrabBagMutation.mutate(bag.id)}
                                disabled={generateGrabBagMutation.isPending}
                              >
                                <Gift className="h-4 w-4 mr-1" />
                                Generate
                              </Button>
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
            </TabsContent>
          </Tabs>
        </TabsContent>

      </Tabs>

      {/* ── Grab Bag Dialogs ──────────────────────────────────────────────────── */}

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

      {/* Generate Result Dialog */}
      <Dialog open={generateResultOpen} onOpenChange={setGenerateResultOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Grab Bag Generated!
            </DialogTitle>
          </DialogHeader>
          {generateResult && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Product <span className="font-bold">"{generateResult.product.name}"</span> has been added to your catalog.
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
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setGenerateResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Grab Bag Dialog */}
      <Dialog open={showGrabBagModal} onOpenChange={(open) => { setShowGrabBagModal(open); if (!open) { setEditingGrabBag(null); resetGrabBagForm(); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGrabBag ? "Edit" : "New"} Grab Bag Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Mystery Sampler"
                value={grabBagForm.name}
                onChange={e => setGrabBagForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description shown to customers"
                value={grabBagForm.description}
                onChange={e => setGrabBagForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selling Price * <span className="text-gray-400 font-normal text-xs">(what customers pay)</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    className="pl-7"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={grabBagForm.sellingPrice}
                    onChange={e => setGrabBagForm(f => ({ ...f, sellingPrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Max Total Item Price * <span className="text-gray-400 font-normal text-xs">(cap on retail value)</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    className="pl-7"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={grabBagForm.maxTotalItemPrice}
                    onChange={e => setGrabBagForm(f => ({ ...f, maxTotalItemPrice: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-gray-400">Items selected will not exceed this total retail value.</p>
              </div>
            </div>

            {/* Specific Products */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                Always Include — Specific Products
              </Label>
              <p className="text-xs text-gray-400">These products are always added to every generated bag.</p>
              <Select
                onValueChange={(val) => {
                  const id = parseInt(val);
                  if (!grabBagForm.specificProductIds.includes(id)) {
                    setGrabBagForm(f => ({ ...f, specificProductIds: [...f.specificProductIds, id] }));
                  }
                }}
                value=""
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add a specific product…" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.filter(p => !grabBagForm.specificProductIds.includes(p.id) && p.price).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} — ${Number(p.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {grabBagForm.specificProductIds.length > 0 && (
                <div className="space-y-1 mt-2">
                  {grabBagForm.specificProductIds.map(pid => {
                    const prod = allProducts.find(p => p.id === pid);
                    return (
                      <div key={pid} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <span>{prod ? `${prod.name} — $${Number(prod.price).toFixed(2)}` : `Product #${pid}`}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setGrabBagForm(f => ({ ...f, specificProductIds: f.specificProductIds.filter(id => id !== pid) }))}>
                          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Random Picks */}
            <div className="space-y-2">
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
                    {allCategories.filter(c => c.isActive && !grabBagForm.categorySelections.find(s => s.categoryId === c.id)).map(c => (
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
                if (!grabBagForm.maxTotalItemPrice) return toast({ title: "Max total item price is required", variant: "destructive" });
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{promoCodeForm.discountType === 'percent' ? 'Percent Off *' : 'Dollar Amount Off *'}</Label>
                <Input
                  type="number" min="0" step={promoCodeForm.discountType === 'percent' ? "1" : "0.01"}
                  placeholder={promoCodeForm.discountType === 'percent' ? "e.g. 20" : "e.g. 10.00"}
                  value={promoCodeForm.discountValue}
                  onChange={e => setPromoCodeForm(f => ({ ...f, discountValue: e.target.value }))}
                />
              </div>
            </div>
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
              disabled={!promoCodeForm.code || !promoCodeForm.discountValue || createPromoCodeMutation.isPending || updatePromoCodeMutation.isPending}
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


      {/* Ticket Review Modal */}
      <Dialog open={showTicketModal} onOpenChange={handleCloseTicketModal}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Ticket #{selectedTicket?.ticket.id} - {selectedTicket?.ticket.subject}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Customer:</span>
              <span>{selectedTicket?.ticket.customerName || (selectedTicket?.user ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName}` : 'Anonymous')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Created:</span>
              <span>{selectedTicket?.ticket.createdAt ? format(new Date(selectedTicket.ticket.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-gray-400" />
              <span className="font-semibold">Priority:</span>
              <Badge className={getPriorityColor(selectedTicket?.ticket.priority || 'normal')}>
                {selectedTicket?.ticket.priority.charAt(0).toUpperCase() + selectedTicket?.ticket.priority.slice(1)}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-gray-400" />
                <span className="font-semibold">Message:</span>
              </div>
              <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                {selectedTicket?.ticket.message}
              </p>
            </div>
            <hr />
            <div className="space-y-2">
              <label className="block text-sm font-medium">Your Response</label>
              <Textarea
                placeholder="Write your response to the customer..."
                value={ticketResponse}
                onChange={(e) => setTicketResponse(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseTicketModal}>
              Cancel
            </Button>
            <Button onClick={handleSendResponse} disabled={!ticketResponse || sendTicketResponseMutation.isPending}>
              {sendTicketResponseMutation.isPending ? 'Sending...' : 'Send Response'}
            </Button>
          </DialogFooter>
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