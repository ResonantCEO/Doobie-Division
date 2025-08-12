import { useState, useMemo, useEffect } from "react";
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

  // Filter products by stock and deals only (search and category filtering is handled by backend)
  const products = allProducts.filter(product => {
    const hasStock = product.stock > 0;
    const matchesDeals = !showDealsOnly || (product.discountPercentage && parseFloat(product.discountPercentage) > 0);

    return hasStock && matchesDeals;
  });

  // Debug logging to understand what's happening
  console.log('All products from API:', allProducts.length);
  console.log('Filtered products:', products.length);
  console.log('Current parent category:', currentParentCategory);
  console.log('Products:', products.map(p => ({ id: p.id, name: p.name, categoryId: p.category?.id, categoryName: p.category?.name })));



  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative rounded-2xl mb-12 overflow-hidden">
        {/* Background Image Carousel */}
        <div className="absolute inset-0">
          {allDiscountedProducts.length > 0 ? (
            <div className="relative w-full h-full">
              {allDiscountedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    currentImageIndex === index ? 'opacity-100' : 'opacity-0'
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
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white">
            {currentParentCategory ? 'Subcategories:' : 'Categories:'}
          </h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {/* Always show All Products button */}
            <Button
              variant={selectedCategory === null && !showDealsOnly && !currentParentCategory ? "default" : "outline"}
              size="sm"
              className="glass-button text-black dark:text-white"
              onClick={() => {
                handleCategoryFilter(null);
                setShowDealsOnly(false);
              }}
            >
              All Products
            </Button>

            {currentParentCategory ? (
              // Show subcategories when a parent category is selected
              (() => {
                const subcategoriesForParent = categories.filter(cat => cat.parentId === currentParentCategory);
                const parentCategory = categories.find(cat => cat.id === currentParentCategory);
                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-button text-black dark:text-white"
                      onClick={() => {
                        if (selectedCategory) {
                          // If we have a selected subcategory, go back to parent category view
                          setSelectedCategory(null);
                          // Keep the currentParentCategory to show the subcategories again
                        } else {
                          // If we're viewing subcategories, go back to main categories
                          setCurrentParentCategory(null);
                        }
                        setShowDealsOnly(false);
                      }}
                    >
                      ← Back
                    </Button>
                    {subcategoriesForParent.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="sm"
                        className="glass-button text-black dark:text-white"
                        onClick={() => handleCategoryFilter(category.id)}
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

      {/* Products by Category */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">No products found</p>
          <p className="text-muted-foreground/60 mt-2">Try adjusting your search or category filter</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            // If we're viewing a parent category with subcategories, group by subcategories
            if (currentParentCategory && !selectedCategory) {
              const subcategoriesForParent = categories.filter(cat => cat.parentId === currentParentCategory);
              
              if (subcategoriesForParent.length > 0) {
                // Group products by their direct subcategory
                const productsBySubcategory = new Map<number, (Product & { category: Category | null })[]>();
                
                // First, group all products by their category ID
                products.forEach(product => {
                  if (product.category) {
                    if (!productsBySubcategory.has(product.category.id)) {
                      productsBySubcategory.set(product.category.id, []);
                    }
                    productsBySubcategory.get(product.category.id)!.push(product);
                  }
                });

                // Always show all subcategories, even if they have no products
                return subcategoriesForParent.map(subcategory => {
                  // Get products that belong to this specific subcategory OR any of its children
                  const getProductsForSubcategory = (subcategoryId: number): (Product & { category: Category | null })[] => {
                    // Get direct products for this subcategory
                    const directProducts = productsBySubcategory.get(subcategoryId) || [];
                    
                    // Get all child categories of this subcategory
                    const childCategories = categories.filter(cat => cat.parentId === subcategoryId);
                    
                    // Get products from all child categories
                    const childProducts: (Product & { category: Category | null })[] = [];
                    childCategories.forEach(childCat => {
                      const childCatProducts = productsBySubcategory.get(childCat.id) || [];
                      childProducts.push(...childCatProducts);
                    });
                    
                    return [...directProducts, ...childProducts];
                  };

                  const subcategoryProducts = getProductsForSubcategory(subcategory.id);

                  return (
                    <div key={subcategory.id} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 
                          className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors duration-200"
                          onClick={() => handleCategoryFilter(subcategory.id)}
                        >
                          {subcategory.name}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          {subcategoryProducts.length} products
                        </span>
                      </div>
                      
                      {/* Horizontal Scrolling Product Container */}
                      <div className="relative">
                        {subcategoryProducts.length > 0 ? (
                          <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
                            <div className="flex space-x-4" style={{ minWidth: 'max-content' }}>
                              {subcategoryProducts.map((product) => (
                                <div key={product.id} className="flex-shrink-0 w-64 sm:w-72">
                                  <ProductCard product={product} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No products available in this category</p>
                          </div>
                        )}
                        
                        {/* Scroll indicators */}
                        {subcategoryProducts.length > 0 && (
                          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
                        )}
                      </div>
                    </div>
                  );
                });
              }
            }

            // Default behavior: Group products by main parent category (root level)
            const productsByParentCategory = new Map<number | null, (Product & { category: Category | null })[]>();
            
            products.forEach(product => {
              if (!product.category) {
                // Products without category
                if (!productsByParentCategory.has(null)) {
                  productsByParentCategory.set(null, []);
                }
                productsByParentCategory.get(null)!.push(product);
                return;
              }

              // Find the root parent category
              let rootCategoryId = product.category.id;
              let currentCategory = product.category;
              
              // Traverse up the category tree to find the root parent
              while (currentCategory.parentId) {
                const parentCategory = categories.find(cat => cat.id === currentCategory.parentId);
                if (parentCategory) {
                  rootCategoryId = parentCategory.id;
                  currentCategory = parentCategory;
                } else {
                  break;
                }
              }
              
              if (!productsByParentCategory.has(rootCategoryId)) {
                productsByParentCategory.set(rootCategoryId, []);
              }
              productsByParentCategory.get(rootCategoryId)!.push(product);
            });

            return Array.from(productsByParentCategory.entries()).map(([parentCategoryId, categoryProducts]) => {
              if (categoryProducts.length === 0) return null;

              // Find the root category info
              const rootCategory = parentCategoryId 
                ? categories.find(cat => cat.id === parentCategoryId)
                : null;

              const categoryName = rootCategory?.name || 'Uncategorized';

              return (
                <div key={parentCategoryId || 'uncategorized'} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 
                      className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors duration-200"
                      onClick={() => {
                        if (parentCategoryId) {
                          handleCategoryFilter(parentCategoryId);
                        }
                      }}
                    >
                      {categoryName}
                    </h3>
                  </div>
                  
                  {/* Horizontal Scrolling Product Container */}
                  <div className="relative">
                    <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
                      <div className="flex space-x-4" style={{ minWidth: 'max-content' }}>
                        {categoryProducts.map((product) => (
                          <div key={product.id} className="flex-shrink-0 w-64 sm:w-72">
                            <ProductCard product={product} />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Scroll indicators */}
                    <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
                  </div>
                </div>
              );
            }).filter(Boolean);
          })()}
        </div>
      )}
    </div>
  );
}