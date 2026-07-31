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
import { Search, ChevronLeft, ChevronRight, Megaphone, ImagePlus, Trash2, X, ShoppingBag, Check, Pencil, GripVertical, ArrowUpDown, Save, Gift } from "lucide-react";
import { useCart, type CgBagCartItem } from "@/contexts/cart-context";
import type { Product, Category, PromotionalAd, BoardPost } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


function SortableProductItem({ product }: { product: Product & { category: Category | null } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-30 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 cursor-grab active:cursor-grabbing shadow-lg touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="product-card-mobile-grid sm:product-card-container">
        <ProductCard product={product} />
      </div>
    </div>
  );
}

function CategoryReorderGrid({
  categoryKey,
  products,
  onReorder,
}: {
  categoryKey: string;
  products: (Product & { category: Category | null })[];
  onReorder: (categoryKey: string, newProducts: (Product & { category: Category | null })[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(categoryKey, arrayMove(products, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={products.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.map((product) => (
            <SortableProductItem key={product.id} product={product} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ScrollableProductRow({ products }: { products: (Product & { category: Category | null })[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product) => (
        <div key={product.id} className="product-card-mobile-grid sm:product-card-container">
          <ProductCard product={product} />
        </div>
      ))}
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
  const [postSelectedProductIds, setPostSelectedProductIds] = useState<number[]>([]);
  const [postProductSearch, setPostProductSearch] = useState("");
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);
  // When editing, keep the existing image URL (so user can keep it without re-uploading)
  const [editingExistingImageUrl, setEditingExistingImageUrl] = useState<string | null>(null);

  // Ad product filter — set when user taps a board post with linked products
  const [adProductFilter, setAdProductFilter] = useState<number[] | null>(null);

  // Customer Generated bag modal state
  const { addCgBag } = useCart();
  interface CgTemplate { id: number; name: string; description?: string | null; sellingPrice: string; maxTotalItemPrice: string; }
  const [cgBagModalOpen, setCgBagModalOpen] = useState(false);
  const [cgBagModalTemplate, setCgBagModalTemplate] = useState<CgTemplate | null>(null);
  const [cgBagSelectedCatIds, setCgBagSelectedCatIds] = useState<number[]>([]);

  const { data: cgTemplates = [] } = useQuery<CgTemplate[]>({
    queryKey: ["/api/grab-bags/customer-generated"],
    queryFn: async () => {
      const res = await fetch('/api/grab-bags/customer-generated');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  // Reorder mode (admin only)
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [localProductGroups, setLocalProductGroups] = useState<Map<string, (Product & { category: Category | null })[]>>(new Map());

  const reorderMutation = useMutation({
    mutationFn: async (orders: { id: number; sortOrder: number }[]) => {
      await apiRequest("PATCH", "/api/products/reorder", { orders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsReorderMode(false);
      setLocalProductGroups(new Map());
      toast({ title: "Product order saved!" });
    },
    onError: () => {
      toast({ title: "Failed to save order", variant: "destructive" });
    },
  });

  const handleSaveReorder = () => {
    const orders: { id: number; sortOrder: number }[] = [];
    localProductGroups.forEach((groupProducts) => {
      groupProducts.forEach((product, index) => {
        orders.push({ id: product.id, sortOrder: index });
      });
    });
    reorderMutation.mutate(orders);
  };

  const handleReorder = (categoryKey: string, newProducts: (Product & { category: Category | null })[]) => {
    setLocalProductGroups(prev => new Map(prev).set(categoryKey, newProducts));
  };

  const getGroupProducts = (categoryKey: string, defaultProducts: (Product & { category: Category | null })[]) => {
    return localProductGroups.get(categoryKey) ?? defaultProducts;
  };

  // Fetch ALL products (unfiltered) for hero section and modal product selector
  const { data: allProductsRaw = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "all-raw"],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    staleTime: 60000,
    gcTime: 300000,
    refetchOnMount: true,
  });

  // Filter to deal products for hero section
  const allDiscountedProducts = useMemo(() => {
    return allProductsRaw.filter((product: Product) => {
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
  }, [allProductsRaw]);

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

  const resetPostModal = () => {
    setPostText("");
    setPostImageFile(null);
    setPostImagePreview(null);
    setPostSelectedProductIds([]);
    setPostProductSearch("");
    setEditingPost(null);
    setEditingExistingImageUrl(null);
  };

  const openEditModal = (post: BoardPost) => {
    setEditingPost(post);
    setPostText(post.text ?? "");
    setEditingExistingImageUrl(post.imageUrl ?? null);
    setPostImageFile(null);
    setPostImagePreview(null);
    const ids: number[] = post.productIds ? (() => { try { return JSON.parse(post.productIds); } catch { return []; } })() : [];
    setPostSelectedProductIds(ids);
    setPostProductSearch("");
    setAdvertiseOpen(true);
  };

  // Submit new board post or save edit
  const handlePostSubmit = async () => {
    const isEditing = !!editingPost;
    if (!postText.trim() && !postImageFile && !editingExistingImageUrl) {
      toast({ title: "Add text or an image first", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let imageUrl: string | null = editingExistingImageUrl;
      if (postImageFile) {
        const formData = new FormData();
        formData.append('image', postImageFile);
        const uploadRes = await fetch('/api/upload/board-image', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.imageUrl;
      }

      if (isEditing) {
        const res = await fetch(`/api/board-posts/${editingPost.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: postText.trim() || null,
            imageUrl,
            productIds: postSelectedProductIds.length > 0 ? postSelectedProductIds : null,
          }),
        });
        if (!res.ok) throw new Error('Failed to update post');
        toast({ title: "Post updated!" });
      } else {
        const res = await fetch('/api/board-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: postText.trim() || null,
            imageUrl,
            productIds: postSelectedProductIds.length > 0 ? postSelectedProductIds : undefined,
          }),
        });
        if (!res.ok) throw new Error('Failed to create post');
        toast({ title: "Post published!" });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/board-posts"] });
      setAdvertiseOpen(false);
      resetPostModal();
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

    setAdProductFilter(null);
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
      if (adProductFilter) return hasStock && adProductFilter.includes(product.id);
      if (!showDealsOnly) return hasStock;
      const hasDiscountPct = product.discountPercentage && parseFloat(String(product.discountPercentage)) > 0;
      const hasDiscountAmt = (product as any).discountAmount && parseFloat(String((product as any).discountAmount)) > 0;
      const hasDiscount = hasDiscountPct || hasDiscountAmt;
      const hasBogo = product.bogoEnabled === true;
      const hasQuantityPricing = Array.isArray((product as any).quantityPricing) && (product as any).quantityPricing.length > 0;
      const isGrabBag = (product as any).sku?.startsWith("GRAB-BAG-");
      return hasStock && (hasDiscount || hasBogo || hasQuantityPricing || isGrabBag);
    });
  }, [allProducts, showDealsOnly, adProductFilter]);

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
          {boardPosts.map((post) => {
            const linkedIds: number[] = post.productIds ? (() => { try { return JSON.parse(post.productIds); } catch { return []; } })() : [];
            const hasLinkedProducts = linkedIds.length > 0;
            const isActive = adProductFilter !== null && linkedIds.length > 0 && linkedIds.every(id => adProductFilter.includes(id));
            return (
              <div
                key={post.id}
                className={`relative rounded-xl border bg-card shadow-sm overflow-hidden ${hasLinkedProducts ? 'cursor-pointer hover:border-primary transition-colors' : ''} ${isActive ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                onClick={hasLinkedProducts ? () => {
                  if (isActive) {
                    setAdProductFilter(null);
                  } else {
                    setAdProductFilter(linkedIds);
                    setTimeout(() => {
                      document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }
                } : undefined}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(post); }}
                      className="bg-black/50 rounded-full p-1.5 text-white hover:bg-primary/80 transition-colors"
                      title="Edit post"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBoardPostMutation.mutate(post.id); }}
                      className="bg-black/50 rounded-full p-1.5 text-white hover:bg-destructive/80 transition-colors"
                      title="Remove post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt="Board post"
                    className="w-full max-h-72 object-cover"
                  />
                )}
                <div className={post.imageUrl ? 'p-4' : 'p-4'}>
                  {post.text && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{post.text}</p>
                  )}
                  {hasLinkedProducts && (
                    <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {isActive ? 'Showing linked products — tap to clear' : `Tap to shop ${linkedIds.length === 1 ? 'this product' : `${linkedIds.length} products`}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ad product filter banner */}
      {adProductFilter && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 mb-4">
          <span className="text-sm text-primary font-medium flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Showing products from advertisement
          </span>
          <button onClick={() => setAdProductFilter(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Advertise Dialog */}
      <Dialog open={advertiseOpen} onOpenChange={(open) => {
        setAdvertiseOpen(open);
        if (!open) resetPostModal();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              {editingPost ? "Edit Advertisement" : "Create a Post / Advertisement"}
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
              ) : editingExistingImageUrl ? (
                <div className="relative">
                  <img src={editingExistingImageUrl} alt="Current image" className="rounded-lg max-h-48 w-full object-cover" />
                  <div className="absolute inset-0 flex items-end gap-2 p-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs bg-black/60 text-white px-2 py-1 rounded hover:bg-black/80"
                    >
                      <ImagePlus className="w-3 h-3" /> Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingExistingImageUrl(null)}
                      className="flex items-center gap-1 text-xs bg-black/60 text-white px-2 py-1 rounded hover:bg-red-600/80"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
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

            {/* Link products */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                Link products <span className="text-muted-foreground font-normal">(optional — tap ad to jump to them)</span>
              </p>
              {postSelectedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {postSelectedProductIds.map(id => {
                    const p = allProductsRaw.find(p => p.id === id);
                    return p ? (
                      <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                        {p.name}
                        <button onClick={() => setPostSelectedProductIds(prev => prev.filter(pid => pid !== id))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              <Input
                placeholder="Search products..."
                value={postProductSearch}
                onChange={(e) => setPostProductSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {allProductsRaw
                  .filter(p => p.stock > 0 && p.name.toLowerCase().includes(postProductSearch.toLowerCase()))
                  .slice(0, 30)
                  .map(p => {
                    const selected = postSelectedProductIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPostSelectedProductIds(prev =>
                          selected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        )}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${selected ? 'bg-primary/5' : ''}`}
                      >
                        <span className={selected ? 'text-primary font-medium' : ''}>{p.name}</span>
                        {selected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                {allProductsRaw.filter(p => p.stock > 0 && p.name.toLowerCase().includes(postProductSearch.toLowerCase())).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No products found</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdvertiseOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={handlePostSubmit} disabled={uploading || (!postText.trim() && !postImageFile && !editingExistingImageUrl)}>
                {uploading ? (editingPost ? "Saving..." : "Publishing...") : (editingPost ? "Save Changes" : "Publish")}
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
                  className={`absolute inset-0 transition-opacity duration-1000 cursor-pointer ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                  onClick={() => {
                    const currentState = { parentCategory: currentParentCategory, selectedCategory, showDealsOnly };
                    setNavigationHistory(prev => [...prev, currentState]);
                    setSearchQuery("");
                    setCurrentParentCategory(null);
                    setSelectedCategory(null);
                    setShowDealsOnly(true);
                    setTimeout(() => {
                      document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                >
                  {/* Rotating product background images */}
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
                  {/* Content */}
                  <div className="relative z-10 py-16 px-8">
                    <div className="max-w-2xl">
                      <h2 className="text-4xl font-bold mb-4 text-white drop-shadow-lg">Daily Deals!</h2>
                      <p className="text-xl mb-6 text-white/90 drop-shadow-md">
                        Click here to see our hand selected special discounts for today!
                      </p>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Promotional ad slide
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
                setAdProductFilter(null);
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
      <div id="product-grid" />
      {isAdmin && products.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1">
          {!isReorderMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setIsReorderMode(true); setLocalProductGroups(new Map()); }}
              className="flex items-center gap-2 border-purple-400 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              <ArrowUpDown className="h-4 w-4" />
              Reorder Products
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleSaveReorder}
                disabled={reorderMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="h-4 w-4" />
                {reorderMutation.isPending ? "Saving…" : "Save Order"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setIsReorderMode(false); setLocalProductGroups(new Map()); }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <span className="text-sm text-muted-foreground">Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder products</span>
            </>
          )}
        </div>
      )}
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
                    {isReorderMode ? (
                      <CategoryReorderGrid
                        categoryKey={`parent-direct-${currentParentCategory}`}
                        products={getGroupProducts(`parent-direct-${currentParentCategory}`, parentDirectProducts)}
                        onReorder={handleReorder}
                      />
                    ) : (
                      <ScrollableProductRow products={parentDirectProducts} />
                    )}
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

                      {isReorderMode ? (
                        <CategoryReorderGrid
                          categoryKey={`subcat-${subcategory.id}`}
                          products={getGroupProducts(`subcat-${subcategory.id}`, subcategoryProducts)}
                          onReorder={handleReorder}
                        />
                      ) : (
                        <ScrollableProductRow products={subcategoryProducts} />
                      )}
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

                  {isReorderMode ? (
                    <CategoryReorderGrid
                      categoryKey={`root-${parentCategoryId ?? 'uncategorized'}`}
                      products={getGroupProducts(`root-${parentCategoryId ?? 'uncategorized'}`, categoryProducts)}
                      onReorder={handleReorder}
                    />
                  ) : (
                    <ScrollableProductRow products={categoryProducts} />
                  )}
                </div>
              );
            }).filter(Boolean);
          })()}
        </div>
      )}

      {/* Build Your Bag — Customer Generated templates */}
      {cgTemplates.length > 0 && (
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-blue-500" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Build Your Bag</h3>
          </div>
          <p className="text-sm text-muted-foreground">Pick your categories and we'll put together a mystery bag just for you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cgTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border bg-card shadow-sm p-5 flex flex-col gap-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                onClick={() => {
                  setCgBagModalTemplate(template);
                  setCgBagSelectedCatIds([]);
                  setCgBagModalOpen(true);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Gift className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base">{template.name}</h4>
                    {template.description && <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${Number(template.sellingPrice).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">Target up to ${Number(template.maxTotalItemPrice).toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Pick from any category
                </div>
                <div className="mt-1 w-full text-sm font-medium text-center text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-lg py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  Choose Categories →
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CG Bag Category Picker Modal — always mounted so Radix overlay is never torn mid-animation */}
      <Dialog open={cgBagModalOpen && !!cgBagModalTemplate} onOpenChange={(open) => {
        setCgBagModalOpen(open);
        if (!open) {
          // Delay clearing template until after close animation finishes
          setTimeout(() => { setCgBagModalTemplate(null); setCgBagSelectedCatIds([]); }, 300);
        }
      }}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-blue-500" />
              {cgBagModalTemplate?.name ?? ''}
            </DialogTitle>
          </DialogHeader>
          {cgBagModalTemplate && (
            <div className="space-y-4 py-2">
              {cgBagModalTemplate.description && (
                <p className="text-sm text-muted-foreground">{cgBagModalTemplate.description}</p>
              )}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm font-medium">Bag price</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">${Number(cgBagModalTemplate.sellingPrice).toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Pick your categories <span className="text-muted-foreground font-normal">(select all you'd like)</span></p>
                <p className="text-xs text-muted-foreground">We'll pick 1 item from each category you select, up to the target retail value.</p>
                <div className="space-y-2 mt-2">
                  {categories.filter(c => c.isActive !== false && !c.name.toLowerCase().includes('grab bag')).map((cat) => {
                    const catId = cat.id;
                    const isSelected = cgBagSelectedCatIds.includes(catId);
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => setCgBagSelectedCatIds(prev =>
                          prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
                        )}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-left transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                      >
                        <span className="text-sm font-medium">{cat.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                disabled={cgBagSelectedCatIds.length === 0}
                onClick={() => {
                  if (!cgBagModalTemplate || cgBagSelectedCatIds.length === 0) return;
                  const selectedCategoryNames = cgBagSelectedCatIds
                    .map(id => categories.find(c => c.id === id)?.name || `Category #${id}`)
                    .filter(Boolean) as string[];
                  const cartItem: CgBagCartItem = {
                    cartId: `cg-${cgBagModalTemplate.id}-${Date.now()}`,
                    templateId: cgBagModalTemplate.id,
                    templateName: cgBagModalTemplate.name,
                    sellingPrice: Number(cgBagModalTemplate.sellingPrice),
                    selectedCategoryIds: cgBagSelectedCatIds,
                    categoryNames: selectedCategoryNames,
                  };
                  addCgBag(cartItem);
                  setCgBagModalOpen(false);
                  toast({ title: "Added to cart!", description: `${cgBagModalTemplate.name} — ${selectedCategoryNames.join(', ')}` });
                  setTimeout(() => { setCgBagModalTemplate(null); setCgBagSelectedCatIds([]); }, 300);
                }}
                className="w-full py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cgBagSelectedCatIds.length === 0 ? 'Select at least one category' : `Add to Cart — $${Number(cgBagModalTemplate.sellingPrice).toFixed(2)}`}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}