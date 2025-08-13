import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import QRCodeModal from "@/components/modals/qr-code-modal";
import { Edit, QrCode, Trash2, MoreHorizontal, Package, ChevronUp, ChevronDown } from "lucide-react";
import type { Product, Category } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

type SortField = 'name' | 'sku' | 'category' | 'price' | 'stock';
type SortDirection = 'asc' | 'desc';

interface InventoryTableProps {
  products: (Product & { category: Category | null })[];
  onStockAdjustment: (product: Product) => void;
  onEditProduct?: (product: Product & { category: Category | null }) => void;
}

export default function InventoryTable({ products, onStockAdjustment, onEditProduct }: InventoryTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedProductForQR, setSelectedProductForQR] = useState<Product | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string>("");

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
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
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const getStockBadge = (product: Product) => {
    if (product.stock === 0) {
      return <Badge variant="destructive" className="status-out-of-stock">Out of Stock</Badge>;
    }
    if (product.stock <= product.minStockThreshold) {
      return <Badge variant="secondary" className="status-low-stock">Low Stock</Badge>;
    }
    return null; // Don't show badge for in-stock items
  };

  const handleDeleteProduct = async (productId: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(productId);
    }
  };

  // QR code generation mutation
  const qrCodeMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await fetch(`/api/products/${productId}/qr-code`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to generate QR code: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setQrCodeData(data.qrCode);
      setShowQRModal(true);
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
    setSelectedProductForQR(product);
    qrCodeMutation.mutate(product.id);
  };

  const handleSelectProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    toast({
      title: "Bulk Action",
      description: `${action} applied to ${selectedProducts.size} products`,
    });
    setSelectedProducts(new Set());
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
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'sku':
        aValue = a.sku.toLowerCase();
        bValue = b.sku.toLowerCase();
        break;
      case 'category':
        aValue = (a.category?.name || '').toLowerCase();
        bValue = (b.category?.name || '').toLowerCase();
        break;
      case 'price':
        aValue = Number(a.price || 0);
        bValue = Number(b.price || 0);
        break;
      case 'stock':
        aValue = a.stock;
        bValue = b.stock;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No products found</p>
        <p className="text-gray-400">Try adjusting your filters or add a new product.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {selectedProducts.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              {selectedProducts.size} products selected
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
                onClick={() => setSelectedProducts(new Set())}
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
          {sortedProducts.map((product) => (
            <div key={product.id} className={`p-4 ${selectedProducts.has(product.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedProducts.has(product.id)}
                  onChange={() => handleSelectProduct(product.id)}
                  className="mt-1 rounded border-gray-300"
                />
                <Avatar className="h-12 w-12">
                  <AvatarImage src={product.imageUrl || undefined} />
                  <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-white line-clamp-1">
                        {product.description}
                      </div>
                      <div className="flex items-center mt-1 space-x-4 text-xs text-gray-600 dark:text-white line-clamp-1">
                        <span>SKU: {product.sku}</span>
                        <span>Category: {product.category?.name || "—"}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEditProduct && (
                          <DropdownMenuItem onClick={() => onEditProduct(product)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Product
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onStockAdjustment(product)}>
                          <Package className="h-4 w-4 mr-2" />
                          Adjust Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewQRCode(product)}>
                          <QrCode className="h-4 w-4 mr-2" />
                          View QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm">
                      {product.sellingMethod === "weight" ? (
                        <div className="space-y-1">
                          {product.pricePerGram && (
                            <div className="font-medium text-gray-900 dark:text-white">
                              {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                                <span>
                                  <span className="line-through text-gray-500">${product.pricePerGram}/g</span>
                                  <span className="ml-2 text-green-600">
                                    ${(parseFloat(product.pricePerGram) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}/g
                                  </span>
                                </span>
                              ) : (
                                <span>${product.pricePerGram}/g</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="font-medium text-gray-900 dark:text-white">
                          {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                            <span>
                              <span className="line-through text-gray-500">${Number(product.price || 0).toFixed(2)}</span>
                              <span className="ml-2 text-green-600">
                                ${(Number(product.price || 0) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            `$${Number(product.price || 0).toFixed(2)}`
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          product.stock === 0 ? "text-red-600" : 
                          product.stock <= product.minStockThreshold ? "text-orange-600" : 
                          "text-gray-900 dark:text-white"
                        }`}>
                          {product.stock} units
                        </div>
                        <div className="w-16 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                          <div 
                            className={`h-1 rounded-full transition-all ${
                              product.stock === 0 ? "bg-red-500" :
                              product.stock <= product.minStockThreshold ? "bg-orange-500" :
                              "bg-green-500"
                            }`}
                            style={{ 
                              width: `${Math.min((product.stock / (product.minStockThreshold * 2)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                      {getStockBadge(product)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Inventory Display */}
              <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Stock: {product.stock} units</div>
                  <div>Physical: {product.physicalInventory || 0} units</div>
                </div>
                {product.physicalInventory !== product.stock && (
                  <div className="text-xs text-orange-600 mt-1">
                    Variance: {(product.physicalInventory || 0) - product.stock} units
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Product
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('sku')}
              >
                <div className="flex items-center">
                  SKU
                  {getSortIcon('sku')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center">
                  Category
                  {getSortIcon('category')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center">
                  Price
                  {getSortIcon('price')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('stock')}
              >
                <div className="flex items-center">
                  Stock
                  {getSortIcon('stock')}
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => (
              <TableRow key={product.id} className={selectedProducts.has(product.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => handleSelectProduct(product.id)}
                    className="rounded border-gray-300"
                  />
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
                <TableCell className="font-mono text-sm text-gray-900 dark:text-white">{product.sku}</TableCell>
                <TableCell className="text-gray-900 dark:text-white">{product.category?.name || "—"}</TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  {product.sellingMethod === "weight" ? (
                    <div className="text-sm">
                      {product.pricePerGram && (
                        <div className="space-y-1">
                          {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                            <div>
                              <span className="line-through text-gray-500">${product.pricePerGram}/g</span>
                              <span className="ml-2 text-green-600">
                                ${(parseFloat(product.pricePerGram) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}/g
                              </span>
                              <span className="ml-1 text-xs text-green-600">({product.discountPercentage}% off)</span>
                            </div>
                          ) : (
                            <div>${product.pricePerGram}/g</div>
                          )}
                        </div>
                      )}
                      {product.pricePerOunce && (
                        <div className="space-y-1">
                          {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                            <div>
                              <span className="line-through text-gray-500">${product.pricePerOunce}/oz</span>
                              <span className="ml-2 text-green-600">
                                ${(parseFloat(product.pricePerOunce) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}/oz
                              </span>
                            </div>
                          ) : (
                            <div>${product.pricePerOunce}/oz</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                        <div className="space-y-1">
                          <span className="line-through text-gray-500">${Number(product.price || 0).toFixed(2)}</span>
                          <span className="ml-2 text-green-600">
                            ${(Number(product.price || 0) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}
                          </span>
                          <span className="ml-1 text-xs text-green-600">({product.discountPercentage}% off)</span>
                        </div>
                      ) : (
                        `$${Number(product.price || 0).toFixed(2)}`
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col">
                      <span className={`font-medium text-sm ${
                        product.stock === 0 ? "text-red-600" : 
                        product.stock <= product.minStockThreshold ? "text-orange-600" : 
                        "text-gray-900 dark:text-white"
                      }`}>
                        {product.stock} units
                      </span>
                      <div className="w-16 h-1 bg-gray-200 rounded-full mt-1">
                        <div 
                          className={`h-1 rounded-full transition-all ${
                            product.stock === 0 ? "bg-red-500" :
                            product.stock <= product.minStockThreshold ? "bg-orange-500" :
                            "bg-green-500"
                          }`}
                          style={{ 
                            width: `${Math.min((product.stock / (product.minStockThreshold * 2)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onStockAdjustment(product)}
                      className="h-6 w-6 p-0 text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white"
                      title="Adjust stock"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{getStockBadge(product)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditProduct && onEditProduct(product)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewQRCode(product)}>
                        <QrCode className="h-4 w-4 mr-2" />
                        View QR Code
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* QR Code Modal */}
      {selectedProductForQR && (
        <QRCodeModal
          open={showQRModal}
          onOpenChange={setShowQRModal}
          product={selectedProductForQR}
          qrCode={qrCodeData}
          isLoading={qrCodeMutation.isPending}
        />
      )}
    </div>
  );
}