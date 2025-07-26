import { useState } from "react";
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

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<(Product & { category: Category | null })[]>({
    queryKey: ["/api/products", { 
      search: searchQuery || undefined, 
      categoryId: selectedCategory || undefined 
    }],
  });

  const handleCategoryFilter = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
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

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="hero-gradient rounded-2xl mb-12 overflow-hidden">
        <div 
          className="bg-primary bg-opacity-80 text-white py-16 px-8"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=600)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay'
          }}
        >
          <div className="max-w-2xl">
            <h2 className="text-4xl font-bold mb-4">Discover Amazing Products</h2>
            <p className="text-xl mb-6 text-blue-100">
              Shop from our curated collection of high-quality items with fast delivery
            </p>
            <Button className="bg-white text-primary hover:bg-gray-100">
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
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-4 items-center">
          <h3 className="text-lg font-semibold text-gray-900">Categories:</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryFilter(null)}
            >
              All Products
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategoryFilter(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found</p>
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
