import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import EditProductModal from "@/components/modals/edit-product-modal";
import StockAdjustmentModal from "@/components/modals/stock-adjustment-modal";
import QRCodeModal from "@/components/modals/qr-code-modal";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { MoreHorizontal, Edit, QrCode, TrendingUp, TrendingDown, Package, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Product, Category, User } from "@shared/schema";

type SortField = 'name' | 'sku' | 'category' | 'price' | 'stock' | 'status';
type SortDirection = 'asc' | 'desc';

interface InventoryTableProps {
  products: (Product & { category: Category | null })[];
  user: User | null | undefined;
  selectedProducts: number[];
  onSelectionChange: (productIds: number[]) => void;
}

export default function InventoryTable({ products, user, selectedProducts, onSelectionChange }: InventoryTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  const getStatusBadge = (product: Product) => {
    if (product.stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (product.stock <= product.minStockThreshold) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low Stock</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">In Stock</Badge>;
    }
  };

  const getProductStatus = (product: Product): string => {
    if (product.stock === 0) {
      return 'out_of_stock';
    } else if (product.stock <= product.minStockThreshold) {
      return 'low_stock';
    } else {
      return 'in_stock';
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

  const sortedProducts = [...products].sort((a, b) => {
    let aValue: any;
    let bValue: any;

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
        aValue = a.category?.name?.toLowerCase() || '';
        bValue = b.category?.name?.toLowerCase() || '';
        break;
      case 'price':
        aValue = parseFloat(a.price);
        bValue = parseFloat(b.price);
        break;
      case 'stock':
        aValue = a.stock;
        bValue = b.stock;
        break;
      case 'status':
        const statusOrder = { 'out_of_stock': 0, 'low_stock': 1, 'in_stock': 2 };
        aValue = statusOrder[getProductStatus(a) as keyof typeof statusOrder];
        bValue = statusOrder[getProductStatus(b) as keyof typeof statusOrder];
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
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
    deleteProductMutation.mutate(productId);
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
      setQrCodeProduct(products.find(p => p.id === qrCodeProduct?.id) || null); // Keep track of the product for the modal
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
        <p className="text-gray-400">Try adjusting your filters or add a new product.</p>
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
            </span></div>
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
          {sortedProducts.map((product) => (
            <div key={product.id} className={`p-4 ${selectedProducts && selectedProducts.includes(product.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={selectedProducts ? selectedProducts.includes(product.id) : false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange([...(selectedProducts || []), product.id]);
                    } else {
                      onSelectionChange((selectedProducts || []).filter(id => id !== product.id));
                    }
                  }}
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
                        {user?.role === 'admin' && (
                          <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Product
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setAdjustingStockProduct(product)}>
                          <Package className="h-4 w-4 mr-2" />
                          Adjust Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewQRCode(product)}>
                          <QrCode className="h-4 w-4 mr-2" />
                          View QR Code
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
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
                      {getStatusBadge(product)}
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
                  checked={selectedProducts && selectedProducts.length === sortedProducts.length && sortedProducts.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange(sortedProducts.map(p => p.id));
                    } else {
                      onSelectionChange([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Product
                  {getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('sku')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  SKU
                  {getSortIcon('sku')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('category')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Category
                  {getSortIcon('category')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('price')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Price
                  {getSortIcon('price')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('stock')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Stock
                  {getSortIcon('stock')}
                </Button>
              </TableHead>
              <TableHead>Physical</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('status')}
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                >
                  Status
                  {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => (
              <TableRow key={product.id} className={selectedProducts && selectedProducts.includes(product.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedProducts ? selectedProducts.includes(product.id) : false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectionChange([...(selectedProducts || []), product.id]);
                      } else {
                        onSelectionChange((selectedProducts || []).filter(id => id !== product.id));
                      }
                    }}
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
                      onClick={() => setAdjustingStockProduct(product)}
                      className="h-6 w-6 p-0 text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white"
                      title="Adjust stock"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-900 dark:text-white">
                  <div className="flex flex-col">
                    <span>{product.physicalInventory || 0} units</span>
                    {product.physicalInventory !== product.stock && (
                      <span className="text-xs text-orange-600">
                        Variance: {(product.physicalInventory || 0) - product.stock}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(product)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user?.role === 'admin' && (
                        <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Product
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setAdjustingStockProduct(product)}>
                        <Package className="h-4 w-4 mr-2" />
                        Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewQRCode(product)}>
                        <QrCode className="h-4 w-4 mr-2" />
                        View QR Code
                      </DropdownMenuItem>
                      {user?.role === 'admin' && (
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
      {editingProduct && user?.role === 'admin' && (
        <EditProductModal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          product={editingProduct}
        />
      )}
      {adjustingStockProduct && (
        <StockAdjustmentModal
          isOpen={!!adjustingStockProduct}
          onClose={() => setAdjustingStockProduct(null)}
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
          qrCode={qrCodeMutation.isSuccess && qrCodeProduct ? qrCodeMutation.data?.qrCode : ''}
          isLoading={qrCodeMutation.isPending}
        />
      )}
    </div>
  );
}