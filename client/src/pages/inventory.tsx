import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, QrCode, AlertTriangle, Settings } from "lucide-react";
import type { Product, Category } from "@shared/schema";

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBulkQRModal, setShowBulkQRModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductWithCategory, setSelectedProductWithCategory] = useState<(Product & { category: Category | null }) | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [bulkQRCodes, setBulkQRCodes] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
  const { data: products = [], isLoading } = useQuery<(Product & { category: Category | null })[]>({
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
      
      const response = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    // Remove auto-refresh to stop the 30-second refreshing
  });

  // Fetch low stock products for alerts
  const { data: lowStockProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/low-stock"],
    // Remove auto-refresh to stop the automatic refreshing
  });

  const handleResetFilters = () => {
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Inventory Table */}
      <InventoryTable 
        products={products} 
        user={user}
        selectedProducts={selectedProducts}
        onSelectionChange={setSelectedProducts}
        categories={categories}
      />

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
    </div>
  );
}
