import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProductCard from "@/components/product-card";
import { Search, ChevronLeft, ChevronRight, Megaphone, ImagePlus, Trash2, X } from "lucide-react";
import type { Product, Category, PromotionalAd, BoardPost } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";


function ScrollableProductRow({ products, onCategoryFilter }: { products: (Product & { category: Category | null })[], onCategoryFilter?: (id: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll, products]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      <div ref={scrollRef} className="flex space-x-8 overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex space-x-8" style={{ minWidth: 'max-content' }}>
          {products.map((product, index) => (
            <div key={product.id} className={`flex-shrink-0 w-64 sm:w-72 my-6 ${index === 0 ? 'ml-6' : ''}`}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

export default function StorefrontPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showDealsOnly, setShowDealsOnly] = useState(false);
  const [currentParentCategory, setCurrentParentCategory] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState<Array<{
    parentCategory: number | null;
    selectedCategory: number | null;
    showDealsOnly: boolean;
  }>>([]);

  // Advertise modal state
  const [advertiseOpen, setAdvertiseOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all deal products for hero section (independent of filters)
  // Includes: discounted products, BOGO products, quantity-priced products
  const { data: allDiscountedProducts = [] } = useQuery({
    queryKey: ["/api/products", "discounted"],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const products = await response.json();
      return products.filter((product: Product) => {
        if (product.stock <= 0) return false;
        const discount = product.discountPercentage;
        const hasDiscountPct = discount && discount !== "0" && discount !== 0 &&
          !isNaN(typeof discount === 'number' ? discount : parseFloat(String(discount))) &&
          (typeof discount === 'number' ? discount : parseFloat(String(discount))) > 0;
        const discountAmt = (product as any).discountAmount;
        const hasDiscountAmt = discountAmt && parseFloat(String(discountAmt)) > 0;
        const hasDiscount = hasDiscountPct || hasDiscountAmt;
        const hasBogo = product.bogoEnabled === true;
        const hasQuantityPricing = Array.isArray((product as any).quantityPricing) && (product as any).quantityPricing.length > 0;
        const isGrabBag = (product as any).sku?.startsWith("GRAB-BAG-");
        return hasDiscount || hasBogo || hasQuantityPricing || isGrabBag;
      });
    },
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: true,
  });

  // Fetch active promotional ads
  const { data: activeAds = [] } = useQuery<PromotionalAd[]>({
    queryKey: ["/api/ads"],
    queryFn: async () => {
      const res = await fetch('/api/ads');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Fetch board posts (message board)
  const { data: boardPosts = [] } = useQuery<BoardPost[]>({
    queryKey: ["/api/board-posts"],
    queryFn: async () => {
      const res = await fetch('/api/board-posts');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  // Delete board post mutation
  const deleteBoardPostMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/board-posts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete post');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board-posts"] });
      toast({ title: "Post removed" });
    },
  });

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPostImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Submit new board post
  const handlePostSubmit = async () => {
    if (!postText.trim() && !postImageFile) {
      toast({ title: "Add text or an image first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      if (postImageFile) {
        const formData = new FormData();
        formData.append('image', postImageFile);
        const uploadRes = await fetch('/api/upload/board-image', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.imageUrl;
      }
      const res = await fetch('/api/board-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: postText.trim() || null, imageUrl }),
      });
      if (!res.ok) throw new Error('Failed to create post');
      queryClient.invalidateQueries({ queryKey: ["/api/board-posts"] });
      toast({ title: "Post published!" });
      setAdvertiseOpen(false);
      setPostText("");
      setPostImageFile(null);
      setPostImagePreview(null);
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Build merged slides array: deals slide first (if any), then ad slides
  type DealsSlide = { type: 'deals' };
  type AdSlide = { type: 'ad'; ad: PromotionalAd };
  type Slide = DealsSlide | AdSlide;

  const slides: Slide[] = useMemo(() => {
    const result: Slide[] = [];
    if (allDiscountedProducts.length > 0) result.push({ type: 'deals' });
    activeAds.forEach(ad => result.push({ type: 'ad', ad }));
    return result;
  }, [allDiscountedProducts.length, activeAds]);

  // Current image index within the deals slide (for background rotation)
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Rotate through slides
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev >= slides.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Rotate background images within the deals slide
  useEffect(() => {
    if (allDiscountedProducts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev >= allDiscountedProducts.length - 1 ? 0 : prev + 1));
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
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
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
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const handleCategoryFilter = (categoryId: number | null) => {
    // Save current state to navigation history before changing
    const currentState = {
      parentCategory: currentParentCategory,
      selectedCategory: selectedCategory,
      showDealsOnly: showDealsOnly
    };
    setNavigationHistory(prev => [...prev, currentState]);

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

  // Filter products by stock and deals only (search and category filtering is handled by backend)
  // IMPORTANT: All hooks must be called before any conditional returns
  const products = useMemo(() => {
    return allProducts.filter((product: Product & { category: Category | null }) => {
      const hasStock = product.stock > 0;
      if (!showDealsOnly) return hasStock;
      const hasDiscountPct = product.discountPercentage && parseFloat(String(product.discountPercentage)) > 0;
      const hasDiscountAmt = (product as any).discountAmount && parseFloat(String((product as any).discountAmount)) > 0;
      const hasDiscount = hasDiscountPct || hasDiscountAmt;
      const hasBogo = product.bogoEnabled === true;
      const hasQuantityPricing = Array.isArray((product as any).quantityPricing) && (product as any).quantityPricing.length > 0;
      return hasStock && (hasDiscount || hasBogo || hasQuantityPricing);
    });
  }, [allProducts, showDealsOnly]);

  // Build a set of category IDs that have products (directly or in descendants)
  // This is used to hide empty categories
  const categoriesWithProducts = useMemo(() => {
    const hasProducts = new Set<number>();
    const categoryById = new Map<number, Category>();
    categories.forEach(cat => categoryById.set(cat.id, cat));

    // Helper to get all descendant category IDs (recursive)
    const getAllDescendants = (parentId: number, visited = new Set<number>()): number[] => {
      if (visited.has(parentId)) return []; // Cycle protection
      visited.add(parentId);
      
      const directChildren = categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => cat.id);
      
      let allDescendants = [...directChildren];
      for (const childId of directChildren) {
        allDescendants = allDescendants.concat(getAllDescendants(childId, visited));
      }
      return allDescendants;
    };

    // Step 1: Mark categories that have direct products
    products.forEach((product: Product & { category: Category | null }) => {
      if (product.category) {
        hasProducts.add(product.category.id);
      }
    });

    // Step 2: For each category with products, mark all its ancestors (walk up the tree)
    products.forEach((product: Product & { category: Category | null }) => {
      if (!product.category) return;
      
      let currentId: number | null = product.category.id;
      const visited = new Set<number>();
      while (currentId) {
        if (visited.has(currentId)) break; // Cycle protection
        visited.add(currentId);
        
        const category = categoryById.get(currentId);
        if (category?.parentId) {
          hasProducts.add(category.parentId);
          currentId = category.parentId;
        } else {
          break;
        }
      }
    });

    // Step 3: For each category, check if any of its descendants (recursively) have products
    // This ensures categories like "Clothing" show up if "Mens" (a subcategory) has products
    categories.forEach(cat => {
      const descendants = getAllDescendants(cat.id);
      const hasProductsInSubtree = descendants.some(descId => hasProducts.has(descId));
      if (hasProductsInSubtree) {
        hasProducts.add(cat.id);
      }
    });

    // Step 4: Propagate up the tree again to ensure all ancestors of newly marked categories are also marked
    // This handles cases where Step 3 marked a category, and we need to mark its ancestors too
    let changed = true;
    while (changed) {
      changed = false;
      categories.forEach(cat => {
        if (hasProducts.has(cat.id) && cat.parentId && !hasProducts.has(cat.parentId)) {
          hasProducts.add(cat.parentId);
          changed = true;
        }
      });
    }

    return hasProducts;
  }, [products, categories]);

  // Helper function to check if a category has products (including descendants)
  const categoryHasProducts = useCallback((categoryId: number): boolean => {
    return categoriesWithProducts.has(categoryId);
  }, [categoriesWithProducts]);

  if (productsLoading || categoriesLoading) {
    return (
      <div className="space-y-8 relative min-h-screen">
        <div className="relative z-10">
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
      </div>
    );
  }

  return (
    <div className="space-y-8 relative min-h-screen">
      <div className="relative z-10">

      {/* Admin: Advertise button + Message Board */}
      {isAdmin && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            className="flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
            onClick={() => setAdvertiseOpen(true)}
          >
            <Megaphone className="w-4 h-4" />
            Advertise
          </Button>
        </div>
      )}

      {/* Message Board - board posts shown above daily deals */}
      {boardPosts.length > 0 && (
        <div className="space-y-3 mb-4">
          {boardPosts.map((post) => (
            <div
              key={post.id}
              className="relative rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              {isAdmin && (
                <button
                  onClick={() => deleteBoardPostMutation.mutate(post.id)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt="Board post"
                  className="rounded-lg max-h-72 w-full object-cover mb-3"
                />
              )}
              {post.text && (
                <p className="text-sm text-foreground whitespace-pre-wrap">{post.text}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Advertise Dialog */}
      <Dialog open={advertiseOpen} onOpenChange={(open) => {
        setAdvertiseOpen(open);
        if (!open) {
          setPostText("");
          setPostImageFile(null);
          setPostImagePreview(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Create a Post / Advertisement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Textarea
              placeholder="Type your message here... (optional if uploading an image)"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={4}
              className="resize-none"
            />

            {/* Image upload area */}
            <div>
              {postImagePreview ? (
                <div className="relative">
                  <img src={postImagePreview} alt="Preview" className="rounded-lg max-h-48 w-full object-cover" />
                  <button
                    onClick={() => { setPostImageFile(null); setPostImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-sm">Click to upload an image (optional)</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdvertiseOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handlePostSubmit} disabled={uploading || (!postText.trim() && !postImageFile)}>
                {uploading ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hero Carousel - show if there are deals or active ads */}
      {slides.length > 0 && (
        <div className="relative rounded-2xl mb-12 overflow-hidden" style={{ minHeight: '260px' }}>
          {/* Slides */}
          {slides.map((slide, slideIdx) => {
            const isActive = currentSlideIndex === slideIdx;
            if (slide.type === 'deals') {
              return (
                <div
                  key="deals"
                  className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  {allDiscountedProducts.map((product: Product, imgIdx: number) => (
                    <div
                      key={product.id}
                      className={`absolute inset-0 transition-opacity duration-1000 ${currentImageIndex === imgIdx ? 'opacity-100' : 'opacity-0'}`}
                    >
                      <img
                        src={(product as any).imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=400&fit=crop"}
                        alt={product.name}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-black/50" />
                    </div>
                  ))}
                  <div className="relative z-10 py-16 px-8">
                    <div className="max-w-2xl">
                      <h2 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">Today's Amazing Deals!</h2>
                      <p className="text-xl mb-6 text-white/90 drop-shadow-md">
                        Check out our special discounts on selected products every day!
                      </p>
                      <Button
                        className="bg-white text-primary hover:bg-white/90 drop-shadow-md"
                        onClick={() => {
                          const currentState = { parentCategory: currentParentCategory, selectedCategory, showDealsOnly };
                          setNavigationHistory(prev => [...prev, currentState]);
                          setShowDealsOnly(true);
                        }}
                      >
                        Shop Now
                      </Button>
                    </div>
                  </div>
                </div>
              );
            } else {
              const { ad } = slide;
              return (
                <div
                  key={`ad-${ad.id}`}
                  className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                  style={{ background: ad.backgroundImageUrl ? undefined : (ad.backgroundColor || '#1a1a2e') }}
                >
                  {ad.backgroundImageUrl && (
                    <>
                      <img src={ad.backgroundImageUrl} alt={ad.title} className="absolute inset-0 w-full h-full object-cover object-center" />
                      <div className="absolute inset-0 bg-black/45" />
                    </>
                  )}
                  <div className="relative z-10 py-16 px-8">
                    <div className="max-w-2xl">
                      <h2
                        className="text-4xl font-bold mb-4 drop-shadow-lg"
                        style={{ color: ad.textColor || 'white' }}
                      >
                        {ad.title}
                      </h2>
                      {ad.subtitle && (
                        <p className="text-xl mb-6 drop-shadow-md" style={{ color: ad.textColor ? `${ad.textColor}cc` : 'rgba(255,255,255,0.9)' }}>
                          {ad.subtitle}
                        </p>
                      )}
                      {ad.buttonText && (
                        <Button
                          className="bg-white text-primary hover:bg-white/90 drop-shadow-md"
                          onClick={() => {
                            if (ad.buttonLink) navigate(ad.buttonLink);
                          }}
                        >
                          {ad.buttonText}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })}

          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${currentSlideIndex === idx ? 'bg-white w-5' : 'bg-white/50'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
                // Save current state before going to all products
                if (currentParentCategory || selectedCategory || showDealsOnly) {
                  const currentState = {
                    parentCategory: currentParentCategory,
                    selectedCategory: selectedCategory,
                    showDealsOnly: showDealsOnly
                  };
                  setNavigationHistory(prev => [...prev, currentState]);
                }
                setCurrentParentCategory(null);
                setSelectedCategory(null);
                setShowDealsOnly(false);
              }}
            >
              All Products
            </Button>

            {currentParentCategory ? (
              // Show subcategories when a parent category is selected
              (() => {
                const subcategoriesForParent = categories
                  .filter(cat => cat.parentId === currentParentCategory)
                  .filter(cat => categoryHasProducts(cat.id)); // Only show categories with products
                const parentCategory = categories.find(cat => cat.id === currentParentCategory);
                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="glass-button text-black dark:text-white"
                      onClick={() => {
                        if (navigationHistory.length > 0) {
                          // Go back to the previous state
                          const previousState = navigationHistory[navigationHistory.length - 1];
                          setCurrentParentCategory(previousState.parentCategory);
                          setSelectedCategory(previousState.selectedCategory);
                          setShowDealsOnly(previousState.showDealsOnly);
                          // Remove the last state from history
                          setNavigationHistory(prev => prev.slice(0, -1));
                        } else {
                          // Fallback to main categories if no history
                          setCurrentParentCategory(null);
                          setSelectedCategory(null);
                          setShowDealsOnly(false);
                        }
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
                  .filter(category => categoryHasProducts(category.id)) // Only show categories with products
                  .sort((a, b) => a.sortOrder - b.sortOrder) // Sort by sortOrder
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
              const subcategoriesForParent = categories
                .filter(cat => cat.parentId === currentParentCategory)
                .filter(cat => categoryHasProducts(cat.id)); // Only show subcategories with products

              // Group products by their direct category ID
              const productsBySubcategory = new Map<number, (Product & { category: Category | null })[]>();
              products.forEach(product => {
                if (product.category) {
                  if (!productsBySubcategory.has(product.category.id)) {
                    productsBySubcategory.set(product.category.id, []);
                  }
                  productsBySubcategory.get(product.category.id)!.push(product);
                }
              });

              // Get products directly assigned to the parent category
              const parentDirectProducts = productsBySubcategory.get(currentParentCategory) || [];
              const parentCategory = categories.find(cat => cat.id === currentParentCategory);

              const sections: JSX.Element[] = [];

              // Show parent category products if any exist
              if (parentDirectProducts.length > 0) {
                sections.push(
                  <div key={`${currentParentCategory}-direct`} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 
                        className="text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors duration-200"
                        onClick={() => handleCategoryFilter(currentParentCategory)}
                      >
                        {parentCategory?.name || "All Products"}
                      </h3>
                    </div>
                    <ScrollableProductRow products={parentDirectProducts} />
                  </div>
                );
              }

              // Helper function to recursively get all descendant category IDs
              const getAllDescendantIds = (parentId: number, visited = new Set<number>()): number[] => {
                if (visited.has(parentId)) return []; // Cycle protection
                visited.add(parentId);
                
                const directChildren = categories
                  .filter(cat => cat.parentId === parentId)
                  .map(cat => cat.id);
                
                let allDescendants = [...directChildren];
                for (const childId of directChildren) {
                  allDescendants = allDescendants.concat(getAllDescendantIds(childId, visited));
                }
                return allDescendants;
              };

              // Helper function to get products for a subcategory and ALL its descendants (recursive)
              const getProductsForSubcategory = (subcategoryId: number): (Product & { category: Category | null })[] => {
                const directProducts = productsBySubcategory.get(subcategoryId) || [];
                
                // Get all descendant category IDs recursively
                const descendantIds = getAllDescendantIds(subcategoryId);
                
                // Get products from all descendant categories
                const descendantProducts: (Product & { category: Category | null })[] = [];
                descendantIds.forEach(descId => {
                  const descProducts = productsBySubcategory.get(descId) || [];
                  descendantProducts.push(...descProducts);
                });
                
                return [...directProducts, ...descendantProducts];
              };

              // Show subcategories that have products
              if (subcategoriesForParent.length > 0) {
                const subcategorySections = subcategoriesForParent
                  .filter(subcategory => {
                    const subcategoryProducts = getProductsForSubcategory(subcategory.id);
                    return subcategoryProducts.length > 0;
                  })
                  .map(subcategory => {
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
                      </div>

                      <ScrollableProductRow products={subcategoryProducts} />
                    </div>
                  );
                });
                sections.push(...subcategorySections);
              }

              // Return all sections (parent direct products + subcategories)
              return sections.length > 0 ? sections : null;
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

            // Sort the root categories by their sortOrder before mapping
            const sortedRootCategoryIds = Array.from(productsByParentCategory.keys()).sort((a, b) => {
              if (a === null) return 1; // null (uncategorized) comes last
              if (b === null) return -1;
              const categoryA = categories.find(cat => cat.id === a);
              const categoryB = categories.find(cat => cat.id === b);
              if (!categoryA) return 1;
              if (!categoryB) return -1;
              return categoryA.sortOrder - categoryB.sortOrder;
            });


            return sortedRootCategoryIds.map((parentCategoryId) => {
              const categoryProducts = productsByParentCategory.get(parentCategoryId) || [];
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

                  <ScrollableProductRow products={categoryProducts} />
                </div>
              );
            }).filter(Boolean);
          })()}
        </div>
      )}
      </div>
    </div>
  );
}