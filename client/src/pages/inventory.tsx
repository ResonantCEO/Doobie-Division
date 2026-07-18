import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import InventoryTable from "@/components/inventory-table";
import AddProductModal from "@/components/modals/add-product-modal";
import EditProductModal from "@/components/modals/edit-product-modal";
import StockAdjustmentModal from "@/components/modals/stock-adjustment-modal";
import CategoryManagementModal from "@/components/modals/category-management-modal";
import BulkQRModal from "@/components/modals/bulk-qr-modal";
import PriceTemplatesModal from "@/components/modals/price-templates-modal";
import { Plus, QrCode, AlertTriangle, Settings, FileText, Download } from "lucide-react";
import type { Product, Category, ProductSize } from "@shared/schema";

function openInventoryPrintSheet(
  products: (Product & { category: Category | null; sizes?: ProductSize[] })[]
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  type Row = {
    sku: string;
    name: string;
    category: string;
    price: string;
    systemStock: string;
    size: string;
    status: string;
  };

  const rows: Row[] = [];

  const sortedProducts = [...products].sort((a, b) => {
    const catA = (a.category?.name ?? "").toLowerCase();
    const catB = (b.category?.name ?? "").toLowerCase();
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  for (const product of sortedProducts) {
    const category = product.category?.name ?? "";
    const price =
      product.sellingMethod === "weight"
        ? product.pricePerGram
          ? `$${Number(product.pricePerGram).toFixed(2)}/g`
          : ""
        : `$${Number(product.price ?? 0).toFixed(2)}`;
    const status =
      product.stock === 0
        ? "Out of Stock"
        : product.stock <= product.minStockThreshold
        ? "Low Stock"
        : "In Stock";

    if (product.sizes && product.sizes.length > 0) {
      for (const size of product.sizes) {
        rows.push({
          sku: product.sku,
          name: product.name,
          category,
          price,
          systemStock: String(size.quantity),
          size: size.size,
          status,
        });
      }
    } else {
      const stockDisplay =
        product.sellingMethod === "weight"
          ? `${product.stock}g`
          : String(product.stock);
      rows.push({
        sku: product.sku,
        name: product.name,
        category,
        price,
        systemStock: stockDisplay,
        size: "",
        status,
      });
    }
  }

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const categoryMap = new Map<string, typeof rows>();
  for (const row of rows) {
    const cat = row.category || "Uncategorized";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(row);
  }

  const categoryNames = Array.from(categoryMap.keys());

  const categorySections = categoryNames.map((catName, sectionIdx) => {
    const catRows = categoryMap.get(catName)!;
    const tableRows = catRows.map((r, i) => `
      <tr class="${i % 2 === 0 ? "even" : "odd"}">
        <td>${esc(r.sku)}</td>
        <td class="name">${esc(r.name)}${r.size ? `<span class="size-tag">${esc(r.size)}</span>` : ""}</td>
        <td class="num">${esc(r.price)}</td>
        <td class="num stock ${r.status === "Out of Stock" ? "out" : r.status === "Low Stock" ? "low" : ""}">${esc(r.systemStock)}</td>
        <td class="write"></td>
        <td class="write"></td>
        <td class="notes"></td>
      </tr>`).join("");

    const isLast = sectionIdx === categoryNames.length - 1;
    return `
  <div class="page-section${isLast ? " last-section" : ""}">
    <div class="page-header">
      <div>
        <h1>Inventory Count Sheet</h1>
        <p>Exported ${dateStr} at ${timeStr} &nbsp;·&nbsp; ${products.length} products total</p>
      </div>
      <div class="page-num"><span class="cat-label">${esc(catName)}</span> &nbsp;·&nbsp; Page ${sectionIdx + 1} of ${categoryNames.length}</div>
    </div>
    <div class="category-banner"><span class="cat-count">${catRows.length} item${catRows.length !== 1 ? "s" : ""}</span></div>
    <div class="legend">
      <span><span class="dot" style="background:#27ae60"></span> In Stock</span>
      <span><span class="dot" style="background:#e67e22"></span> Low Stock</span>
      <span><span class="dot" style="background:#c0392b"></span> Out of Stock</span>
      <span style="margin-left:auto; color:#2d6a2d">■ Green = physical count</span>
      <span style="color:#1a4a6a">■ Blue = notes</span>
    </div>
    <table>
      <thead>
        <tr>
          <th colspan="7" style="background:#fff; color:#111; padding: 6px 8px 4px; border-bottom: 1px solid #ddd; border-right: none;">
            <span style="font-size:14px; font-weight:800; color:#111;">${esc(catName)}</span>
            <span style="float:right; font-size:11px; font-weight:600; color:#111;">Page ${sectionIdx + 1} of ${categoryNames.length}</span>
          </th>
        </tr>
        <tr>
          <th>SKU</th>
          <th>Product / Size</th>
          <th class="num">Price</th>
          <th class="num">System Stock</th>
          <th class="write">Physical Count</th>
          <th class="write">Variance</th>
          <th class="notes">Notes</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">Doobie Division! · Inventory Count Sheet · ${dateStr} · ${esc(catName)}</div>
  </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inventory Sheet — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .page-section { page-break-after: always; }
    .page-section.last-section { page-break-after: auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; padding: 12px 16px 8px; border-bottom: 2px solid #111; }
    .page-header h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .page-header p { font-size: 10px; color: #555; }
    .page-num { font-size: 11px; font-weight: 600; color: #111; white-space: nowrap; text-align: right; }
    .cat-label { font-size: 14px; font-weight: 800; color: #111; }
    .category-banner { padding: 4px 16px; background: #f0f0f0; border-bottom: 1px solid #ccc; display: flex; align-items: center; gap: 10px; }
    .cat-count { font-size: 10px; font-weight: 600; color: #555; }
    .legend { display: flex; gap: 16px; padding: 5px 16px; font-size: 9px; border-bottom: 1px solid #ccc; }
    .legend span { display: flex; align-items: center; gap: 4px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #2a2a4e;
      color: #fff;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      text-align: left;
      border-right: 1px solid #444;
    }
    thead th.num { text-align: right; }
    thead th.write { background: #2d4a2d; text-align: center; }
    thead th.notes { background: #1a2d4a; }
    tbody tr.even { background: #f9f9f9; }
    tbody tr.odd { background: #fff; }
    td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; border-right: 1px solid #e8e8e8; vertical-align: middle; }
    td.num { text-align: right; }
    td.stock { font-weight: 600; }
    td.stock.out { color: #c0392b; }
    td.stock.low { color: #e67e22; }
    td.write { background: #f4fbf4; min-width: 70px; border-right: 1px solid #b0d4b0; }
    td.notes { background: #f0f4ff; min-width: 120px; }
    td.name { font-weight: 500; }
    .size-tag { display: inline-block; margin-left: 5px; font-size: 9px; background: #e8e8e8; color: #555; padding: 1px 5px; border-radius: 3px; font-weight: normal; }
    .footer { padding: 8px 16px; font-size: 9px; color: #888; border-top: 1px solid #ccc; margin-top: 4px; }
    .print-btn {
      position: fixed; top: 12px; right: 16px;
      background: #1a1a2e; color: #fff; border: none; padding: 8px 18px;
      font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; z-index: 999;
    }
    .print-btn:hover { background: #333; }
    @media print {
      .print-btn { display: none; }
      body { font-size: 10px; }
      thead th { font-size: 8px; padding: 4px 6px; }
      td { padding: 4px 6px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>
  ${categorySections}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function openInboundDocument() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const docNumber = `INB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const blankRows = Array.from({ length: 15 }, (_, i) => `
    <tr>
      <td class="num-cell">${i + 1}</td>
      <td class="product-col"></td>
      <td class="w flavor"></td>
      <td class="w qty"></td>
      <td class="w qty"></td>
      <td class="w notes"></td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Inbound — ${docNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 16px 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 8px; border-bottom: 2px solid #111; margin-bottom: 10px; }
    .header h1 { font-size: 18px; font-weight: 800; }
    .header .sub { font-size: 10px; color: #666; margin-top: 2px; }
    .header .doc-id { font-size: 11px; font-weight: 700; text-align: right; }
    .header .doc-date { font-size: 9px; color: #888; }
    .fields { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0 24px; margin-bottom: 12px; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #111; }
    .field .line { border-bottom: 1px solid #555; height: 28px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead th { background: #111; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 5px 7px; text-align: left; }
    thead th.c { text-align: center; }
    tbody td { border-bottom: 1.5px solid #999; height: 42px; padding: 0 6px; font-size: 10px; border-right: 1px solid #bbb; }
    tbody td.num-cell { width: 22px; text-align: center; color: #aaa; font-size: 9px; background: #f5f5f5; border-right: 1.5px solid #999; }
    tbody td.w { border-right: 1.5px solid #999; }
    tbody td.flavor { border-right: 1.5px solid #999; }
    tbody td.product-col { border-right: none; }
    thead th.flavor-h { border-right: 1.5px solid #444; }
    tbody td.qty { width: 100px; background: #f4fbf4; border-right: 2px solid #7ab87a; }
    thead th.qty-h { border-right: 2px solid #444; }
    tbody td.notes { background: #fafafa; }
    tr:nth-child(even) td.qty { background: #eaf6ea; }
    .footer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; border-top: 1px solid #ccc; padding-top: 10px; }
    .sig { display: flex; flex-direction: column; gap: 10px; }
    .sig-line-row { display: flex; align-items: flex-end; gap: 8px; }
    .sig-label { font-size: 9px; font-weight: 600; white-space: nowrap; min-width: 100px; }
    .sig-line { flex: 1; border-bottom: 1px solid #555; height: 16px; }
    .notes-block label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; display: block; margin-bottom: 4px; }
    .note-lines { display: flex; flex-direction: column; gap: 10px; }
    .note-line { border-bottom: 1.5px solid #999; height: 22px; }
    .print-btn { position: fixed; top: 12px; right: 16px; background: #111; color: #fff; border: none; padding: 7px 16px; font-size: 12px; font-weight: 600; border-radius: 5px; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print</button>

  <div class="header">
    <div>
      <h1>Inbound Delivery Receipt</h1>
    </div>
  </div>

  <div class="fields">
    <div class="field"><label>Vendor / Supplier</label><div class="line"></div></div>
    <div class="field"><label>Delivered By</label><div class="line"></div></div>
    <div class="field"><label>Received By</label><div class="line"></div></div>
    <div class="field"><label>Delivery Date</label><div class="line"></div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product</th>
        <th class="flavor-h">Flavor / Size</th>
        <th class="c qty-h">Qty Delivered</th>
        <th class="c">Qty Confirmed</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${blankRows}</tbody>
  </table>

  <div class="footer-row">
    <div class="notes-block" style="grid-column: 1 / -1;">
      <label>Notes</label>
      <div class="note-lines">
        <div class="note-line"></div>
        <div class="note-line"></div>
        <div class="note-line"></div>
        <div class="note-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }

}

export default function InventoryPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBulkQRModal, setShowBulkQRModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showPrintCategoryDialog, setShowPrintCategoryDialog] = useState(false);
  const [selectedPrintCategories, setSelectedPrintCategories] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductWithCategory, setSelectedProductWithCategory] = useState<(Product & { category: Category | null }) | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [bulkQRCodes, setBulkQRCodes] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Debounce search input so we don't refetch/re-render on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Bulk QR code generation mutation
  const bulkQRMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const response = await fetch('/api/products/generate-qr-codes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) {
        throw new Error(`Failed to generate QR codes: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setBulkQRCodes(data.qrCodes);
      setShowBulkQRModal(true);
      toast({
        title: "QR Codes Generated",
        description: `Generated ${data.qrCodes.length} QR codes successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR codes",
        variant: "destructive",
      });
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch products with filters
  const { data: products = [], isLoading, error } = useQuery<(Product & { category: Category | null; sizes?: ProductSize[] })[]>({
    queryKey: ["/api/products", searchQuery, selectedCategory, stockFilter, categories],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      // Handle hierarchical category filtering like storefront
      if (selectedCategory) {
        const categoryId = parseInt(selectedCategory);
        if (categories.length > 0) {
          // Get all descendants recursively (subcategories and their children)
          const getAllDescendants = (parentId: number): number[] => {
            const directChildren = categories
              .filter(cat => cat.parentId === parentId)
              .map(cat => cat.id);
            
            let allDescendants: number[] = [...directChildren];
            
            // Get grandchildren and deeper levels
            for (const childId of directChildren) {
              allDescendants = allDescendants.concat(getAllDescendants(childId));
            }
            
            return allDescendants;
          };
          
          const descendantIds = getAllDescendants(categoryId);
          
          // Include parent category and all its descendants
          const allCategoryIds = [categoryId, ...descendantIds];
          if (allCategoryIds.length > 0) {
            params.append('categoryIds', allCategoryIds.join(','));
          }
        } else {
          // Fallback to single category if categories not loaded yet
          params.append('categoryId', selectedCategory);
        }
      }
      
      if (stockFilter) params.append('status', stockFilter);
      
      // Add parameter to show all products including inactive ones for inventory management
      params.append('includeInactive', 'true');
      
      const response = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch products:', errorData);
        throw new Error(errorData.message || 'Failed to fetch products');
      }
      const data = await response.json();
      // Ensure all products have sizes array (even if empty)
      const normalizedProducts = Array.isArray(data) ? data.map((p: any) => ({
        ...p,
        sizes: p.sizes || []
      })) : [];
      return normalizedProducts;
    },
    // Ensure we re-fetch when the user revisits the page, even with global staleTime=Infinity
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  // Unique category names present in the current product list
  const allPrintCategories = useMemo(() => {
    const names = new Set<string>();
    for (const p of products) {
      names.add(p.category?.name ?? "Uncategorized");
    }
    return Array.from(names).sort();
  }, [products]);

  function openPrintDialog() {
    setSelectedPrintCategories(new Set(allPrintCategories));
    setShowPrintCategoryDialog(true);
  }

  function togglePrintCategory(name: string) {
    setSelectedPrintCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  // Fetch low stock products for alerts
  const { data: lowStockProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/low-stock"],
    // Remove auto-refresh to stop the automatic refreshing
  });

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedCategory("");
    setStockFilter("");
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value === "all" ? "" : value);
  };

  const handleStockFilterChange = (value: string) => {
    setStockFilter(value === "all" ? "" : value);
  };

  const handleStockAdjustment = (product: Product) => {
    setSelectedProduct(product);
    setShowStockModal(true);
  };

  const handleEditProduct = (product: Product & { category: Category | null }) => {
    setSelectedProductWithCategory(product);
    setShowEditModal(true);
  };

  const handleGenerateQR = () => {
    if (products.length === 0) {
      toast({
        title: "No Products",
        description: "No products found to generate QR codes for.",
        variant: "destructive",
      });
      return;
    }

    const productIds = products.map(p => p.id);
    bulkQRMutation.mutate(productIds);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Error fetching products:', error);
  }

  console.log('Rendering with products:', products.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Inventory Management</h2>
        
        {/* Mobile-first button layout */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-3">
          <Button onClick={() => setShowAddModal(true)} className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
          <Button onClick={() => setShowCategoryModal(true)} variant="outline" className="flex-1 sm:flex-initial">
            <Settings className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Manage Categories</span>
            <span className="sm:hidden">Categories</span>
          </Button>
          <Button onClick={handleGenerateQR} variant="outline" className="flex-1 sm:flex-initial">
            <QrCode className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Generate QR Codes</span>
            <span className="sm:hidden">QR Codes</span>
          </Button>
          <Button onClick={() => setShowTemplatesModal(true)} variant="outline" className="flex-1 sm:flex-initial">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Templates</span>
          </Button>
          <Button
            onClick={openPrintDialog}
            variant="outline"
            className="flex-1 sm:flex-initial"
            disabled={products.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Print Sheet</span>
            <span className="sm:hidden">Print</span>
          </Button>
          <Button
            onClick={() => openInboundDocument()}
            variant="outline"
            className="flex-1 sm:flex-initial"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Inbound</span>
            <span className="sm:hidden">Inbound</span>
          </Button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-500 mr-3" />
              <div>
                <h3 className="font-semibold text-orange-800">Low Stock Alerts</h3>
                <p className="text-orange-700">
                  {lowStockProducts.length} products are running low on stock and need restocking
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
              <Select value={selectedCategory || "all"} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stock Status</label>
              <Select value={stockFilter || "all"} onValueChange={handleStockFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stock Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock Levels</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
              <Input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:invisible">Reset</label>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">
              {products.filter(p => p.isActive).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived
            <Badge variant="secondary" className="ml-2">
              {products.filter(p => !p.isActive).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <InventoryTable 
            products={products.filter(p => p.isActive)} 
            user={user}
            selectedProducts={selectedProducts}
            onSelectionChange={setSelectedProducts}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="archived">
          <InventoryTable 
            products={products.filter(p => !p.isActive)} 
            user={user}
            selectedProducts={selectedProducts}
            onSelectionChange={setSelectedProducts}
            categories={categories}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddProductModal 
        open={showAddModal}
        onOpenChange={setShowAddModal}
        categories={categories}
      />

      {selectedProductWithCategory && (
        <EditProductModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          product={selectedProductWithCategory}
          categories={categories}
        />
      )}

      <StockAdjustmentModal
        open={showStockModal}
        onOpenChange={setShowStockModal}
        product={selectedProduct}
      />

      <CategoryManagementModal
        open={showCategoryModal}
        onOpenChange={setShowCategoryModal}
        categories={categories}
      />

      <BulkQRModal
        open={showBulkQRModal}
        onOpenChange={setShowBulkQRModal}
        qrCodes={bulkQRCodes}
        isLoading={bulkQRMutation.isPending}
      />

      <PriceTemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
      />

      <Dialog open={showPrintCategoryDialog} onOpenChange={setShowPrintCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Categories to Print</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setSelectedPrintCategories(new Set(allPrintCategories))}
            >
              Select All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setSelectedPrintCategories(new Set())}
            >
              Deselect All
            </Button>
          </div>
          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
            {allPrintCategories.map(cat => (
              <label key={cat} className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={selectedPrintCategories.has(cat)}
                  onCheckedChange={() => togglePrintCategory(cat)}
                />
                <span className="text-sm">{cat}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPrintCategoryDialog(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={selectedPrintCategories.size === 0}
              onClick={() => {
                setShowPrintCategoryDialog(false);
                const filtered = products.filter(p =>
                  selectedPrintCategories.has(p.category?.name ?? "Uncategorized")
                );
                openInventoryPrintSheet(filtered);
              }}
            >
              Generate Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
