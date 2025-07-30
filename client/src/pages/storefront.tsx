import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card";
import { Search } from "lucide-react";
import type { Product, Category } from "@shared/schema";

export default function StorefrontPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showDealsOnly, setShowDealsOnly] = useState(false);
  const [currentParentCategory, setCurrentParentCategory] = useState<number | null>(null);

  // Fetch categories and flatten the hierarchical structure
  const { data: categoriesResponse = [], isLoading: categoriesLoading } = useQuery<(Category & { children?: Category[] })[]>({
    queryKey: ["/api/categories"],
  });

  // Flatten the hierarchical structure to work with existing logic
  const categories = useMemo(() => {
    const flattenCategories = (cats: (Category & { children?: Category[] })[]): Category[] => {
      const result: Category[] = [];
      for (const cat of cats) {
        // Add the parent category (without children property)
        const { children, ...parentCat } = cat;
        result.push(parentCat);
        
        // Recursively add all children
        if (children && children.length > 0) {
          result.push(...flattenCategories(children));
        }
      }
      return result;
    };
    
    return flattenCategories(categoriesResponse);
  }, [categoriesResponse]);



  // Fetch products
  const { data: allProducts = [], isLoading: productsLoading } = useQuery<(Product & { category: Category | null })[]>({
    queryKey: ["/api/products", searchQuery, selectedCategory, currentParentCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      // If we have a currentParentCategory, get all products from parent and its subcategories  
      if (currentParentCategory) {
        const subcategoryIds = categories
          .filter(cat => cat.parentId === currentParentCategory)
          .map(cat => cat.id);
        // Include both parent category and its subcategories
        const allCategoryIds = [currentParentCategory, ...subcategoryIds];
        if (allCategoryIds.length > 0) {
          params.append('categoryIds', allCategoryIds.join(','));
        }
      } else if (selectedCategory) {
        params.append('categoryId', selectedCategory.toString());
      }

      const url = `/api/products${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    staleTime: 30000, // Cache for 30 seconds
    cacheTime: 300000, // Keep in cache for 5 minutes
  });

  const handleCategoryFilter = (categoryId: number | null) => {
    if (categoryId) {
      if (categories.length === 0) return;
      
      const subcategoriesForThisParent = categories.filter(cat => cat.parentId === categoryId);
      const hasSubcategories = subcategoriesForThisParent.length > 0;
      
      if (hasSubcategories) {
        setCurrentParentCategory(categoryId);
        setSelectedCategory(null);
      } else {
        setSelectedCategory(categoryId);
        setCurrentParentCategory(null);
      }
    } else {
      setCurrentParentCategory(null);
      setSelectedCategory(null);
    }
  };

  const handleBackToMainCategories = () => {
    setCurrentParentCategory(null);
    setSelectedCategory(null);
    setShowDealsOnly(false);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="space-y-8">
        {/* Hero Section Skeleton */}
        <div className="hero-gradient rounded-2xl p-16">
          <div className="max-w-2xl">
            <Skeleton className="h-12 w-96 mb-4 bg-white/20" />
            <Skeleton className="h-6 w-full mb-6 bg-white/20" />
            <Skeleton className="h-12 w-32 bg-white/20" />
          </div>
        </div>

        {/* Categories Skeleton */}
        <div className="flex flex-wrap gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>

        {/* Products Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Filter products by search, stock, and deals (category filtering is handled by backend)
  const products = allProducts.filter(product => {
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const hasStock = product.stock > 0;

    const matchesDeals = !showDealsOnly || (product.discountPercentage && parseFloat(product.discountPercentage) > 0);

    return matchesSearch && hasStock && matchesDeals;
  });

  // Get discounted products for the hero section
  const discountedProducts = allProducts.filter(product => 
    product.discountPercentage && parseFloat(product.discountPercentage) > 0
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative rounded-2xl mb-12 overflow-hidden">
        {/* Background Image Carousel */}
        <div className="absolute inset-0">
          {discountedProducts.length > 0 ? (
            <div className="relative w-full h-full">
              {discountedProducts.slice(0, 5).map((product, index) => (
                <div
                  key={product.id}
                  className={`absolute inset-0 transition-opacity duration-2000 ${
                    Math.floor(Date.now() / 3000) % discountedProducts.slice(0, 5).length === index
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                >
                  <img
                    src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=400&fit=crop"}
                    alt={product.name}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-black/50"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="hero-gradient w-full h-full"></div>
          )}
        </div>
        
        {/* Content Overlay */}
        <div className="relative py-16 px-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">Today's Amazing Deals!</h2>
            <p className="text-xl mb-6 text-white/90 drop-shadow-md">
              Check out our special discounts on selected products every day!
            </p>
            <Button 
              className="bg-white text-primary hover:bg-white/90 drop-shadow-md"
              onClick={() => setShowDealsOnly(true)}
            >
              Shop Now
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Input
            type="text"
            placeholder="Search products..."
            className="pl-10 glass-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-4 items-center">
          <h3 className="text-lg font-semibold text-black dark:text-white">
            {currentParentCategory ? 'Subcategories:' : 'Categories:'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {currentParentCategory ? (
              // Show subcategories when currentParentCategory is set
              (() => {
                const subcategories = categories.filter(cat => cat.parentId === currentParentCategory);
                const parentCategory = categories.find(cat => cat.id === currentParentCategory);
                
                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-button text-black dark:text-white bg-gray-100 dark:bg-gray-800"
                      onClick={handleBackToMainCategories}
                    >
                      ← Back to Categories
                    </Button>
                    <Button
                      variant={!showDealsOnly ? "default" : "outline"}
                      size="sm"
                      className="glass-button text-black dark:text-white"
                      onClick={() => {
                        setShowDealsOnly(false);
                      }}
                    >
                      All {parentCategory?.name}
                    </Button>
                    {subcategories.map((category) => (
                      <Button
                        key={category.id}
                        variant="outline"
                        size="sm"
                        className="glass-button text-black dark:text-white"
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setCurrentParentCategory(null);
                          setShowDealsOnly(false);
                        }}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </>
                );
              })()
            ) : (
              // Show main categories when currentParentCategory is not set
              <>
                <Button
                  variant={selectedCategory === null && !showDealsOnly ? "default" : "outline"}
                  size="sm"
                  className="glass-button text-black dark:text-white"
                  onClick={() => {
                    handleCategoryFilter(null);
                    setShowDealsOnly(false);
                  }}
                >
                  All Products
                </Button>
                
                {categories
                  .filter(category => !category.parentId) // Only show root categories
                  .map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id && !showDealsOnly ? "default" : "outline"}
                      size="sm"
                      className="glass-button text-black dark:text-white"
                      onClick={() => {
                        handleCategoryFilter(category.id);
                        setShowDealsOnly(false);
                      }}
                    >
                      {category.name}
                    </Button>
                  ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No products found</p>
          <p className="text-muted-foreground/60 mt-2">Try adjusting your search or category filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}