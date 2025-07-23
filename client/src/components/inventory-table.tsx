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
import { Edit, QrCode, Trash2, MoreHorizontal, Package } from "lucide-react";
import type { Product, Category } from "@shared/schema";

interface InventoryTableProps {
  products: (Product & { category: Category | null })[];
  onStockAdjustment: (product: Product) => void;
}

export default function InventoryTable({ products, onStockAdjustment }: InventoryTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());

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
    return <Badge variant="outline" className="status-in-stock">In Stock</Badge>;
  };

  const handleDeleteProduct = async (productId: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(productId);
    }
  };

  const handleViewQRCode = (product: Product) => {
    toast({
      title: "QR Code",
      description: `QR Code for ${product.name} (SKU: ${product.sku})`,
    });
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {selectedProducts.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedProducts.size} products selected
            </span>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction("Export")}
              >
                Export Selected
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction("Update Stock")}
              >
                Bulk Stock Update
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedProducts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className={selectedProducts.has(product.id) ? "bg-blue-50" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
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
                      <div className="text-sm font-medium text-gray-900 line-clamp-1">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {product.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                <TableCell>{product.category?.name || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col">
                      <span className={`font-medium text-sm ${
                        product.stock === 0 ? "text-red-600" : 
                        product.stock <= product.minStockThreshold ? "text-orange-600" : 
                        "text-gray-900"
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
                      className="h-6 w-6 p-0"
                      title="Adjust stock"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  ${Number(product.price).toFixed(2)}
                </TableCell>
                <TableCell>{getStockBadge(product)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onStockAdjustment(product)}>
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
    </div>
  );
}
