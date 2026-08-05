import { useState } from "react";
import { formatWeight } from "@/lib/weightUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EditProductModal from "@/components/modals/edit-product-modal";
import StockAdjustmentModal from "@/components/modals/stock-adjustment-modal";
import QRCodeModal from "@/components/modals/qr-code-modal";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import {
  MoreHorizontal,
  Edit,
  QrCode,
  TrendingUp,
  TrendingDown,
  Package,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  EyeOff,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Product, Category, User, ProductSize } from "@shared/schema";

function applyDiscount(price: number, product: any): number {
  const pct = parseFloat(product.discountPercentage || "0");
  if (pct > 0) return price * (1 - pct / 100);
  const amt = parseFloat(product.discountAmount || "0");
  if (amt > 0) return Math.max(0, price - amt);
  return price;
}
function hasActiveDiscount(product: any): boolean {
  return (
    parseFloat(product.discountPercentage || "0") > 0 ||
    parseFloat(product.discountAmount || "0") > 0
  );
}
function discountLabel(product: any): string {
  const pct = parseFloat(product.discountPercentage || "0");
  if (pct > 0) return `${pct}% off`;
  const amt = parseFloat(product.discountAmount || "0");
  if (amt > 0) return `-$${amt.toFixed(2)}`;
  return "";
}

type SortField = "name" | "sku" | "category" | "price" | "stock" | "status";
type SortDirection = "asc" | "desc";

interface InventoryTableProps {
  products: (Product & { category: Category | null; sizes?: ProductSize[] })[];
  user: User | null | undefined;
  selectedProducts: number[];
  onSelectionChange: (productIds: number[]) => void;
  categories?: Category[];
}

export default function InventoryTable({
  products,
  user,
  selectedProducts,
  onSelectionChange,
  categories = [],
}: InventoryTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<
    (Product & { category: Category | null; sizes?: ProductSize[] }) | null
  >(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<
    (Product & { sizes?: ProductSize[] }) | null
  >(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: (_, productId) => {
      // Optimistically remove the product from all product queries
      queryClient.setQueriesData<
        (Product & { category: Category | null; sizes?: ProductSize[] })[]
      >({ queryKey: ["/api/products"] }, (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((product) => product.id !== productId);
      });
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      // Remove from selected products if it was selected
      onSelectionChange(selectedProducts.filter((id) => id !== productId));
      setDeleteConfirmId(null);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to delete product";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({
      productId,
      isActive,
    }: {
      productId: number;
      isActive: boolean;
    }) => {
      await apiRequest("PUT", `/api/products/${productId}`, {
        isActive: !isActive,
      });
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: `Product ${!isActive ? "shown" : "hidden"} on storefront`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update product visibility",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (product: Product) => {
    let stockBadge: JSX.Element;
    if (product.stock === 0) {
      stockBadge = <Badge variant="destructive">Out of Stock</Badge>;
    } else if (product.stock <= product.minStockThreshold) {
      stockBadge = (
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-800 border-orange-200"
        >
          Low Stock
        </Badge>
      );
    } else {
      stockBadge = (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-200"
        >
          In Stock
        </Badge>
      );
    }
    const bogoBadge = (product as any).bogoEnabled ? (
      <Badge className="bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700">
        BOGO
      </Badge>
    ) : null;
    return (
      <div className="flex flex-col gap-1">
        {stockBadge}
        {bogoBadge}
      </div>
    );
  };

  const getStockUnit = (product: Product) => {
    return product.sellingMethod === "weight" ? "g" : "units";
  };

  const displayStock = (product: Product, value: number) => {
    return product.sellingMethod === "weight"
      ? formatWeight(value)
      : `${value} units`;
  };

  const renderStockAndPhysical = (
    product: Product & { sizes?: ProductSize[] },
    onAdjust: () => void,
  ) => {
    const hasSizes = product.sizes && product.sizes.length > 0;

    const stockVal =
      hasSizes && product.sizes
        ? product.sizes.reduce((s, x) => s + (x.quantity || 0), 0)
        : product.stock;
    const physVal =
      hasSizes && product.sizes
        ? product.sizes.reduce((s, x) => s + (x.physicalQuantity || 0), 0)
        : (product.physicalInventory ?? 0);
    const varianceDiff = physVal - stockVal;
    const sorted =
      hasSizes && product.sizes
        ? [...product.sizes].sort((a, b) => a.size.localeCompare(b.size))
        : [];

    return (
      <div className="text-xs min-w-[200px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 mb-1 pb-1 border-b border-gray-200 dark:border-gray-700 items-center">
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className={`font-medium ${
                stockVal === 0
                  ? "text-red-600"
                  : stockVal <= product.minStockThreshold
                    ? "text-orange-600"
                    : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Total
            </span>
            {varianceDiff !== 0 && (
              <span className="text-orange-500 text-[10px] font-medium">
                ({varianceDiff > 0 ? "+" : ""}
                {varianceDiff})
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdjust}
              className="h-4 w-4 p-0 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
              title="Adjust stock"
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
          <span
            className={`font-semibold justify-self-end ${
              stockVal === 0
                ? "text-red-600"
                : stockVal <= product.minStockThreshold
                  ? "text-orange-600"
                  : "text-gray-900 dark:text-white"
            }`}
          >
            {hasSizes ? stockVal : displayStock(product, stockVal)}
          </span>
          <span
            className={`font-semibold justify-self-end ${
              physVal === 0
                ? "text-red-600"
                : varianceDiff !== 0
                  ? "text-orange-500"
                  : "text-gray-900 dark:text-white"
            }`}
          >
            {hasSizes ? physVal : displayStock(product, physVal)}
          </span>
        </div>
        {sorted.length > 0 && (
          <div className="space-y-0.5">
            {sorted.map((size) => {
              const sv = (size.physicalQuantity || 0) - (size.quantity || 0);
              return (
                <div
                  key={size.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-baseline"
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {size.size}:
                  </span>
                  <span
                    className={`font-semibold justify-self-end ${
                      size.quantity === 0
                        ? "text-red-600"
                        : size.quantity <= product.minStockThreshold
                          ? "text-orange-600"
                          : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {size.quantity}
                  </span>
                  <span
                    className={`font-semibold justify-self-end ${
                      (size.physicalQuantity || 0) === 0
                        ? "text-red-600"
                        : sv !== 0
                          ? "text-orange-500"
                          : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {size.physicalQuantity || 0}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getProductStatus = (product: Product): string => {
    if (product.stock === 0) {
      return "out_of_stock";
    } else if (product.stock <= product.minStockThreshold) {
      return "low_stock";
    } else {
      return "in_stock";
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const sortedProducts = [...products].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "sku":
        aValue = a.sku.toLowerCase();
        bValue = b.sku.toLowerCase();
        break;
      case "category":
        aValue = a.category?.name?.toLowerCase() || "";
        bValue = b.category?.name?.toLowerCase() || "";
        break;
      case "price":
        aValue = parseFloat(a.price);
        bValue = parseFloat(b.price);
        break;
      case "stock":
        aValue = a.stock;
        bValue = b.stock;
        break;
      case "status":
        const statusOrder = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
        aValue = statusOrder[getProductStatus(a) as keyof typeof statusOrder];
        bValue = statusOrder[getProductStatus(b) as keyof typeof statusOrder];
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  const handleDeleteProduct = (product: Product) => {
    setEditingProduct(product); // Reusing editingProduct state for productToDelete for simplicity
    setAdjustingStockProduct(null); // Clear other modals
    setQrCodeProduct(null);
    // Confirm dialog is handled directly in the JSX now
  };

  const confirmDelete = (productId: number) => {
    setDeleteConfirmId(productId);
  };

  // QR code generation mutation
  const qrCodeMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`/api/products/${productId}/qr-code`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to generate QR code: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setQrCodeProduct(
        products.find((p) => p.id === qrCodeProduct?.id) || null,
      ); // Keep track of the product for the modal
      // The actual QR code data will be passed to the modal
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });

  const handleViewQRCode = (product: Product) => {
    setQrCodeProduct(product);
    setEditingProduct(null);
    setAdjustingStockProduct(null);
    qrCodeMutation.mutate(product.id);
  };

  const handleBulkAction = (action: string) => {
    toast({
      title: "Bulk Action",
      description: `${action} applied to ${selectedProducts.length} products`,
    });
    onSelectionChange([]); // Clear selection
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No products found</p>
        <p className="text-gray-400">
          Try adjusting your filters or add a new product.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {selectedProducts && selectedProducts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {selectedProducts.length} products selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("Export")}
              >
                Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("Update Stock")}
              >
                <span className="hidden sm:inline">Bulk Stock Update</span>
                <span className="sm:hidden">Update Stock</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectionChange([])}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="md:hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedProducts.map((product) => {
            const hasSizes = product.sizes && product.sizes.length > 0;
            const stockTotal = hasSizes
              ? product.sizes!.reduce((s, x) => s + (x.quantity || 0), 0)
              : product.stock;
            const physTotal = hasSizes
              ? product.sizes!.reduce(
                  (s, x) => s + (x.physicalQuantity || 0),
                  0,
                )
              : (product.physicalInventory ?? 0);
            const hasVariance = physTotal !== stockTotal;
            const variance = physTotal - stockTotal;

            return (
              <div
                key={product.id}
                className={`p-4 ${selectedProducts && selectedProducts.includes(product.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
              >
                {/* Top row: archive icon + image + name/meta + menu */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`shrink-0 h-8 w-8 p-0 ${product.isActive ? "text-green-600 hover:text-orange-500" : "text-gray-400 hover:text-green-600"}`}
                    onClick={() =>
                      toggleVisibilityMutation.mutate({
                        productId: product.id,
                        isActive: product.isActive,
                      })
                    }
                    title={
                      product.isActive
                        ? "Active – tap to archive"
                        : "Archived – tap to restore"
                    }
                  >
                    {product.isActive ? (
                      <Archive className="h-5 w-5" />
                    ) : (
                      <ArchiveRestore className="h-5 w-5" />
                    )}
                  </Button>
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={product.imageUrl || undefined} />
                    <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {product.name}
                    </div>
                    {product.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {product.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{product.sku}</span>
                      {product.category?.name && (
                        <>
                          <span>·</span>
                          <span>{product.category.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(product)}</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user?.role === "admin" && (
                        <DropdownMenuItem
                          onClick={() => setEditingProduct(product)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Product
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setAdjustingStockProduct(product)}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleViewQRCode(product)}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        View QR Code
                      </DropdownMenuItem>
                      {(user?.role === "admin" ||
                        user?.role === "manager" ||
                        user?.role === "staff") && (
                        <DropdownMenuItem
                          onClick={() => confirmDelete(product.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Bottom row: price (left) + stock info (right) */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  {/* Price */}
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {product.sellingMethod === "weight" ? (
                      <div className="space-y-0.5">
                        {product.pricePerGram && (
                          <div>
                            {hasActiveDiscount(product) ? (
                              <>
                                <span className="line-through text-gray-400 text-xs mr-1">
                                  ${Number(product.pricePerGram).toFixed(2)}/g
                                </span>
                                <span className="text-green-600">
                                  $
                                  {applyDiscount(
                                    Number(product.pricePerGram),
                                    product,
                                  ).toFixed(2)}
                                  /g
                                </span>
                              </>
                            ) : (
                              <span>
                                ${Number(product.pricePerGram).toFixed(2)}/g
                              </span>
                            )}
                          </div>
                        )}
                        {product.pricePerOunce && (
                          <div className="text-xs text-muted-foreground">
                            ${product.pricePerOunce}/oz
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {hasActiveDiscount(product) ? (
                          <>
                            <span className="line-through text-gray-400 text-xs mr-1">
                              ${Number(product.price || 0).toFixed(2)}
                            </span>
                            <span className="text-green-600">
                              $
                              {applyDiscount(
                                Number(product.price || 0),
                                product,
                              ).toFixed(2)}
                            </span>
                          </>
                        ) : (
                          `$${Number(product.price || 0).toFixed(2)}`
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock / Physical — mini table matching desktop layout */}
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_72px_72px] mb-1">
                    <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">
                      Stock / Physical
                    </span>
                    <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] text-right">
                      Stock
                    </span>
                    <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] text-right">
                      Physical
                    </span>
                  </div>

                  {/* Totals row */}
                  <div className="grid grid-cols-[1fr_72px_72px] py-0.5">
                    <span className="font-semibold text-white flex items-center gap-1">
                      Total
                      {hasVariance && (
                        <span className="text-orange-500 font-medium">
                          ({variance > 0 ? "+" : ""}
                          {product.sellingMethod === "weight"
                            ? formatWeight(Math.abs(variance))
                            : Math.abs(variance)}
                          )
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-white text-right tabular-nums">
                      {displayStock(product, stockTotal)}
                    </span>
                    <span
                      className={`font-semibold text-right tabular-nums ${hasVariance ? "text-orange-500" : "text-white"}`}
                    >
                      {displayStock(product, physTotal)}
                    </span>
                  </div>

                  {/* Per-size rows */}
                  {hasSizes &&
                    [...product.sizes!]
                      .sort((a, b) => a.size.localeCompare(b.size))
                      .map((size) => {
                        const sizeVariance =
                          (size.physicalQuantity || 0) - size.quantity;
                        return (
                          <div
                            key={size.id}
                            className="grid grid-cols-[1fr_72px_72px] py-0.5"
                          >
                            <span
                              className={`${sizeVariance !== 0 ? "text-orange-500" : "text-gray-300"}`}
                            >
                              {size.size}:
                            </span>
                            <span className="text-gray-300 text-right tabular-nums">
                              {size.quantity}
                            </span>
                            <span
                              className={`text-right tabular-nums ${sizeVariance !== 0 ? "text-orange-500" : "text-gray-300"}`}
                            >
                              {size.physicalQuantity || 0}
                            </span>
                          </div>
                        );
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedProducts &&
                    selectedProducts.length === sortedProducts.length &&
                    sortedProducts.length > 0
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange(sortedProducts.map((p) => p.id));
                    } else {
                      onSelectionChange([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead className="w-12">
                <Eye
                  className="h-4 w-4 text-gray-500"
                  title="Storefront Visibility"
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("name")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Product
                  {getSortIcon("name")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("sku")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  SKU
                  {getSortIcon("sku")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("category")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Category
                  {getSortIcon("category")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("price")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Price
                  {getSortIcon("price")}
                </Button>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("stock")}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Stock / Physical
                    {getSortIcon("stock")}
                  </Button>
                </div>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("status")}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Status
                  {getSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => (
              <TableRow
                key={product.id}
                className={
                  selectedProducts && selectedProducts.includes(product.id)
                    ? "bg-blue-50"
                    : ""
                }
              >
                <TableCell>
                  <Checkbox
                    checked={
                      selectedProducts
                        ? selectedProducts.includes(product.id)
                        : false
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectionChange([
                          ...(selectedProducts || []),
                          product.id,
                        ]);
                      } else {
                        onSelectionChange(
                          (selectedProducts || []).filter(
                            (id) => id !== product.id,
                          ),
                        );
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </TableCell>
                <TableCell>
                  {user?.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleVisibilityMutation.mutate({
                          productId: product.id,
                          isActive: product.isActive,
                        })
                      }
                      className={`h-8 w-8 p-0 ${product.isActive ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-500"}`}
                      title={
                        product.isActive
                          ? "Visible on storefront - Click to hide"
                          : "Hidden from storefront - Click to show"
                      }
                    >
                      {product.isActive ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={product.imageUrl || undefined} />
                      <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-white line-clamp-1">
                        {product.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm text-gray-900 dark:text-white">
                  {product.sku}
                </TableCell>
                <TableCell className="text-gray-900 dark:text-white">
                  {product.category?.name || "—"}
                </TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {product.sellingMethod === "weight" ? (
                    <div className="text-sm">
                      {product.pricePerGram && (
                        <div className="space-y-1">
                          {hasActiveDiscount(product) ? (
                            <div>
                              <span className="line-through text-gray-500">
                                ${Number(product.pricePerGram).toFixed(2)}/g
                              </span>
                              <span className="ml-2 text-green-600">
                                $
                                {applyDiscount(
                                  Number(product.pricePerGram),
                                  product,
                                ).toFixed(2)}
                                /g
                              </span>
                              <span className="ml-1 text-xs text-green-600">
                                ({discountLabel(product)})
                              </span>
                            </div>
                          ) : (
                            <div>
                              ${Number(product.pricePerGram).toFixed(2)}/g
                            </div>
                          )}
                        </div>
                      )}
                      {product.pricePerOunce && (
                        <div className="space-y-1">
                          {hasActiveDiscount(product) ? (
                            <div>
                              <span className="line-through text-gray-500">
                                ${product.pricePerOunce}/oz
                              </span>
                              <span className="ml-2 text-green-600">
                                $
                                {applyDiscount(
                                  Number(product.pricePerOunce),
                                  product,
                                ).toFixed(2)}
                                /oz
                              </span>
                            </div>
                          ) : (
                            <div>${product.pricePerOunce}/oz</div>
                          )}
                        </div>
                      )}
                      {(product as any).pricePerEighth && (
                        <div className="text-xs text-muted-foreground">
                          ${(product as any).pricePerEighth}/⅛ oz
                        </div>
                      )}
                      {(product as any).pricePerQuarter && (
                        <div className="text-xs text-muted-foreground">
                          ${(product as any).pricePerQuarter}/¼ oz
                        </div>
                      )}
                      {(product as any).pricePerHalf && (
                        <div className="text-xs text-muted-foreground">
                          ${(product as any).pricePerHalf}/½ oz
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {hasActiveDiscount(product) ? (
                        <div className="space-y-1">
                          <span className="line-through text-gray-500">
                            ${Number(product.price || 0).toFixed(2)}
                          </span>
                          <span className="ml-2 text-green-600">
                            $
                            {applyDiscount(
                              Number(product.price || 0),
                              product,
                            ).toFixed(2)}
                          </span>
                          <span className="ml-1 text-xs text-green-600">
                            ({discountLabel(product)})
                          </span>
                        </div>
                      ) : (
                        `$${Number(product.price || 0).toFixed(2)}`
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {renderStockAndPhysical(product, () =>
                    setAdjustingStockProduct(product),
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(product)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user?.role === "admin" && (
                        <DropdownMenuItem
                          onClick={() => setEditingProduct(product)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Product
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setAdjustingStockProduct(product)}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleViewQRCode(product)}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        View QR Code
                      </DropdownMenuItem>
                      {user?.role === "admin" && (
                        <DropdownMenuItem
                          onClick={() => confirmDelete(product.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      {editingProduct && (
        <EditProductModal
          open={!!editingProduct}
          onOpenChange={(open) => {
            if (!open) setEditingProduct(null);
          }}
          product={editingProduct}
          categories={categories}
        />
      )}
      {adjustingStockProduct && (
        <StockAdjustmentModal
          open={!!adjustingStockProduct}
          onOpenChange={(open) => {
            if (!open) setAdjustingStockProduct(null);
          }}
          product={adjustingStockProduct}
        />
      )}
      {qrCodeProduct && (
        <QRCodeModal
          open={!!qrCodeProduct}
          onOpenChange={(open) => {
            if (!open) setQrCodeProduct(null);
          }}
          product={qrCodeProduct}
          qrCode={
            qrCodeMutation.isSuccess && qrCodeProduct
              ? qrCodeMutation.data?.qrCode
              : ""
          }
          isLoading={qrCodeMutation.isPending}
        />
      )}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProductMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId !== null)
                  deleteProductMutation.mutate(deleteConfirmId);
              }}
              disabled={deleteProductMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
