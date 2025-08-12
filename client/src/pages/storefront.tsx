
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card";
import { Search, Sparkles, TrendingUp, Star } from "lucide-react";
import type { Product, Category } from "@shared/schema";

export default function StorefrontPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showDealsOnly, setShowDealsOnly] = useState(false);
  const [currentParentCategory, setCurrentParentCategory] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Fetch all discounted products for hero section (independent of filters)
  const { data: allDiscountedProducts = [] } = useQuery<(Product & { category: Category | null })[]>({
    queryKey: ["/api/products/discounted"],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const products = await response.json();
      return products.filter((product: Product) => 
        product.discountPercentage && parseFloat(product.discountPercentage) > 0
      );
    },
    staleTime: 60000, // Cache for 1 minute
    cacheTime: 300000, // Keep in cache for 5 minutes
  });

  // Image rotation timer for hero section
  useEffect(() => {
    if (allDiscountedProducts.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex >= allDiscountedProducts.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [allDiscountedProducts.length]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 1200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    queryKey: ["/api/products", debouncedSearchQuery, selectedCategory, currentParentCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-8xl mx-auto px-6 py-8 space-y-12">
          {/* Hero Section Skeleton */}
          <div className="premium-hero-card p-16 rounded-3xl overflow-hidden relative">
            <div className="relative z-10 max-w-2xl">
              <Skeleton className="h-16 w-96 mb-6 bg-white/30 rounded-2xl" />
              <Skeleton className="h-6 w-full mb-8 bg-white/20 rounded-xl" />
              <Skeleton className="h-14 w-40 bg-white/30 rounded-xl" />
            </div>
          </div>

          {/* Categories Skeleton */}
          <div className="flex flex-wrap gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-28 rounded-full" />
            ))}
          </div>

          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="premium-card overflow-hidden h-96">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-full rounded-lg" />
                  <Skeleton className="h-4 w-2/3 rounded-lg" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter products by stock and deals only (search and category filtering is handled by backend)
  const products = allProducts.filter(product => {
    const hasStock = product.stock > 0;
    const matchesDeals = !showDealsOnly || (product.discountPercentage && parseFloat(product.discountPercentage) > 0);

    return hasStock && matchesDeals;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-8xl mx-auto px-6 py-8 space-y-12">
        {/* Premium Hero Section */}
        <div className="premium-hero-card rounded-3xl overflow-hidden relative group">
          {/* Dynamic Background with Enhanced Overlay */}
          <div className="absolute inset-0">
            {allDiscountedProducts.length > 0 ? (
              <div className="relative w-full h-full">
                {allDiscountedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className={`absolute inset-0 transition-all duration-1000 ${
                      currentImageIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                    }`}
                  >
                    <img
                      src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1400&h=500&fit=crop"}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="premium-gradient w-full h-full"></div>
            )}
          </div>

          {/* Enhanced Content Overlay */}
          <div className="relative z-10 px-12 py-16 lg:px-16 lg:py-20">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="premium-badge">
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Premium Deals</span>
                </div>
                <div className="premium-badge">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Trending Now</span>
                </div>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-white leading-tight">
                Today's Amazing
                <span className="block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Deals!
                </span>
              </h1>
              
              <p className="text-xl lg:text-2xl mb-8 text-white/90 leading-relaxed max-w-2xl">
                Discover exceptional products with exclusive discounts. 
                <span className="block text-lg text-emerald-300 mt-2">Premium quality, unbeatable prices.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  className="premium-cta-button group"
                  onClick={() => setShowDealsOnly(true)}
                >
                  <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-200" />
                  Shop Premium Deals
                </Button>
                
                <Button 
                  size="lg"
                  variant="outline"
                  className="premium-secondary-button"
                >
                  <Star className="h-5 w-5 mr-2" />
                  View All Products
                </Button>
              </div>
            </div>
          </div>

          {/* Floating Elements */}
          <div className="absolute top-8 right-8 premium-floating-badge">
            <span className="text-sm font-bold text-emerald-600">Up to 50% OFF</span>
          </div>
        </div>

        {/* Enhanced Search Section */}
        <div className="premium-search-section">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search premium products..."
                className="premium-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Premium Category Filters */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">
              {currentParentCategory ? 'Explore Subcategories' : 'Browse Categories'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Find exactly what you're looking for
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {currentParentCategory ? (
              // Enhanced Subcategories View
              (() => {
                const subcategoriesForParent = categories.filter(cat => cat.parentId === currentParentCategory);
                return (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="premium-back-button"
                      onClick={handleBackToMainCategories}
                    >
                      ← Back to Categories
                    </Button>
                    {subcategoriesForParent.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="lg"
                        className={`premium-category-button ${
                          selectedCategory === category.id ? 'active' : ''
                        }`}
                        onClick={() => handleCategoryFilter(category.id)}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </>
                );
              })()
            ) : (
              // Enhanced Main Categories View
              <>
                <Button
                  variant={selectedCategory === null && !showDealsOnly ? "default" : "outline"}
                  size="lg"
                  className={`premium-category-button ${
                    selectedCategory === null && !showDealsOnly ? 'active' : ''
                  }`}
                  onClick={() => {
                    handleCategoryFilter(null);
                    setShowDealsOnly(false);
                  }}
                >
                  <span className="relative">
                    All Products
                    {selectedCategory === null && !showDealsOnly && (
                      <span className="premium-active-indicator"></span>
                    )}
                  </span>
                </Button>

                {categories
                  .filter(category => !category.parentId)
                  .map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id && !showDealsOnly ? "default" : "outline"}
                      size="lg"
                      className={`premium-category-button ${
                        selectedCategory === category.id && !showDealsOnly ? 'active' : ''
                      }`}
                      onClick={() => {
                        handleCategoryFilter(category.id);
                        setShowDealsOnly(false);
                      }}
                    >
                      <span className="relative">
                        {category.name}
                        {selectedCategory === category.id && !showDealsOnly && (
                          <span className="premium-active-indicator"></span>
                        )}
                      </span>
                    </Button>
                  ))}
                  
                <Button
                  variant={showDealsOnly ? "default" : "outline"}
                  size="lg"
                  className={`premium-category-button deals-button ${showDealsOnly ? 'active' : ''}`}
                  onClick={() => setShowDealsOnly(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="relative">
                    Special Deals
                    {showDealsOnly && <span className="premium-active-indicator"></span>}
                  </span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Enhanced Products Grid */}
        {products.length === 0 ? (
          <div className="premium-empty-state">
            <div className="text-center max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Search className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                No products found
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-lg mb-6">
                Try adjusting your search or browse different categories
              </p>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(null);
                  setCurrentParentCategory(null);
                  setShowDealsOnly(false);
                }}
                className="premium-reset-button"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {showDealsOnly ? 'Special Deals' : 'Premium Products'}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  {products.length} {products.length === 1 ? 'product' : 'products'} found
                </p>
              </div>
              
              {products.some(product => product.discountPercentage && parseFloat(product.discountPercentage) > 0) && (
                <div className="premium-deals-indicator">
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Deals Available</span>
                </div>
              )}
            </div>
            
            <div className="premium-products-grid">
              {products.map((product) => (
                <div key={product.id} className="premium-product-container">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
