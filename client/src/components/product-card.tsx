import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/cart-context";
import { useState, useMemo, useEffect, useRef } from "react";
import AddToCartModal from "./add-to-cart-modal";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, Category, ProductSize } from "@shared/schema";

interface ProductCardProps {
  product: Product & { category: Category | null; sizes?: ProductSize[] };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();
  const { addItem } = useCart();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [needsSmallerText, setNeedsSmallerText] = useState(false);
  const productNameRef = useRef<HTMLHeadingElement>(null);

  // Parse imageUrls or fall back to imageUrl
  const productImages = useMemo(() => {
    let images: string[] = [];
    
    // Debug logging
    console.log('[ProductCard] Product data:', {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      imageUrls: (product as any).imageUrls,
      imageUrlsType: typeof (product as any).imageUrls
    });
    
    if ((product as any).imageUrls) {
      try {
        // Handle both string and already-parsed array
        let parsed: any;
        if (typeof (product as any).imageUrls === 'string') {
          parsed = JSON.parse((product as any).imageUrls);
        } else {
          parsed = (product as any).imageUrls;
        }
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          images = parsed;
          console.log('[ProductCard] Parsed imageUrls array:', images.length, 'images');
        }
      } catch (e) {
        console.warn('[ProductCard] Failed to parse imageUrls:', e);
        images = [];
      }
    }
    
    if (images.length === 0 && product.imageUrl) {
      images = [product.imageUrl];
      console.log('[ProductCard] Using single imageUrl as fallback');
    }
    
    if (images.length === 0) {
      images = ["https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop"];
      console.log('[ProductCard] Using default placeholder image');
    }
    
    console.log('[ProductCard] Final images array:', images.length, 'images');
    return images;
  }, [product]);

  // Reset image index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [product.id]);

  const currentImage = productImages[currentImageIndex] || productImages[0];
  const hasMultipleImages = productImages.length > 1;
  
  // Debug logging
  useEffect(() => {
    console.log('[ProductCard] Render state:', {
      productId: product.id,
      productName: product.name,
      totalImages: productImages.length,
      hasMultipleImages,
      currentImageIndex,
      currentImage: currentImage?.substring(0, 50) + '...'
    });
  }, [product.id, productImages.length, hasMultipleImages, currentImageIndex, currentImage, product.name]);

  // Check if product name is truncated and needs smaller text
  useEffect(() => {
    const checkTruncation = () => {
      if (productNameRef.current) {
        const element = productNameRef.current;
        const styles = getComputedStyle(element);
        
        // Create a hidden clone to measure text without line-clamp
        const clone = element.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.webkitLineClamp = 'none';
        clone.style.display = 'block';
        clone.style.overflow = 'visible';
        clone.style.textOverflow = 'clip';
        clone.style.width = element.offsetWidth + 'px';
        
        document.body.appendChild(clone);
        const cloneHeight = clone.offsetHeight;
        document.body.removeChild(clone);
        
        // Calculate max height for 2 lines
        const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.2;
        const maxHeightFor2Lines = lineHeight * 2;
        
        // If clone height exceeds 2 lines, use smaller text
        setNeedsSmallerText(cloneHeight > maxHeightFor2Lines);
      }
    };

    // Check after a short delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(checkTruncation, 100);
    
    // Also check on window resize
    window.addEventListener('resize', checkTruncation);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [product.name, product.id]);

  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
  };

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const hasSizes = product.sizes && product.sizes.length > 0;
  const allSizesOutOfStock = hasSizes && product.sizes!.every(s => s.quantity <= 0);
  const isOutOfStock = product.stock === 0 || allSizesOutOfStock;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;

    setShowAddToCartModal(true);
  };

  const getStockStatus = () => {
    if (isOutOfStock) {
      return { label: "Out of Stock", variant: "destructive" as const };
    }
    if (product.stock <= product.minStockThreshold) {
      return { label: `Low Stock (${product.stock})`, variant: "secondary" as const };
    }
    return null;
  };

  const stockStatus = getStockStatus();

  return (
    <div className="product-card-container h-full perspective-1000">
      <div
        className={`product-card-inner relative w-full h-full transition-transform duration-700 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        onClick={handleCardClick}
      >
        {/* Front of card */}
        <Card className="product-card-face product-card-front absolute inset-0 w-full h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-premium hover:shadow-premium-hover transition-all duration-500 ease-out flex flex-col rounded-2xl overflow-hidden">
          <div className="w-full h-1/2 overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 rounded-t-2xl relative group">
            <img
              src={currentImage}
              alt={product.name}
              className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-300"
            />
            {hasMultipleImages && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 shadow-lg transition-all z-20 flex items-center justify-center backdrop-blur-sm opacity-70 hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 shadow-lg transition-all z-20 flex items-center justify-center backdrop-blur-sm opacity-70 hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-black/20 px-2 py-1.5 rounded-full backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity">
                  {productImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                      }}
                      className={`rounded-full transition-all ${
                        index === currentImageIndex
                          ? "bg-white/90 w-2.5 h-2.5"
                          : "bg-white/40 w-2 h-2 hover:bg-white/60"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="absolute top-2 right-2 bg-black/30 text-white text-xs px-2 py-1 rounded-full z-20 backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity">
                  {currentImageIndex + 1} / {productImages.length}
                </div>
              </>
            )}
          </div>
          <CardContent className="pt-2 pb-3 px-3 sm:pt-2 sm:pb-4 sm:px-4 bg-white dark:bg-gray-900 flex flex-col flex-1 min-h-0 overflow-hidden rounded-b-2xl">
            <div className="text-center flex-shrink-0">
              <h4 
                ref={productNameRef}
                className={`${needsSmallerText ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} text-purple-600 dark:text-purple-400 line-clamp-2 mb-0.5 uppercase tracking-wide`}
                style={{ fontFamily: '"Fredoka One", "Bungee", "Chewy", "Modak", cursive, sans-serif' }}
              >
                {product.name}
              </h4>
              {(product as any).company && (
                <p className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide mt-0.5">{(product as any).company}</p>
              )}
              {product.category && (
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mt-0.5">{product.category.name}</p>
              )}
            </div>

            <div className="flex-1 min-h-0"></div>

            <div className="space-y-1.5 sm:space-y-2 flex-shrink-0 mt-auto">
              {stockStatus && (
                <div className="flex justify-center">
                  <Badge
                    variant={stockStatus.variant === "destructive" ? "destructive" : "secondary"}
                    className={`
                      font-semibold text-xs px-3 py-1
                      ${stockStatus.variant === "destructive"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                      }
                    `}
                  >
                    {stockStatus.label}
                  </Badge>
                </div>
              )}
              <div className="text-center">
                {product.sellingMethod === "weight" ? (
                  (() => {
                    const discount = product.discountPercentage ? parseFloat(product.discountPercentage) : 0;
                    const weightOpts = [
                      { label: "g", price: product.pricePerGram },
                      { label: "⅛ oz", price: (product as any).pricePerEighth },
                      { label: "¼ oz", price: (product as any).pricePerQuarter },
                      { label: "½ oz", price: (product as any).pricePerHalf },
                      { label: "1 oz", price: product.pricePerOunce },
                    ].filter(o => Number(o.price) > 0);
                    const renderOpt = (opt: { label: string; price: any }) => {
                      const base = Number(opt.price);
                      const final = discount > 0 ? base * (1 - discount / 100) : base;
                      return (
                        <div key={opt.label} className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {discount > 0 ? (
                            <span className="text-green-600 dark:text-green-400">${final.toFixed(2)}</span>
                          ) : (
                            <span>${base.toFixed(2)}</span>
                          )}
                          <span className="text-gray-500 dark:text-gray-400 font-normal">/{opt.label}</span>
                        </div>
                      );
                    };
                    const isOdd = weightOpts.length % 2 !== 0;
                    const mainOpts = isOdd ? weightOpts.slice(0, -1) : weightOpts;
                    const lastOpt = isOdd ? weightOpts[weightOpts.length - 1] : null;
                    const rows: (typeof weightOpts)[] = [];
                    for (let i = 0; i < mainOpts.length; i += 2) {
                      rows.push(mainOpts.slice(i, i + 2));
                    }
                    return (
                      <div className="space-y-0.5">
                        {rows.map((row, i) => (
                          <div key={i} className="flex justify-center gap-x-2">
                            {row.map(renderOpt)}
                          </div>
                        ))}
                        {lastOpt && (
                          <div className="flex justify-center">
                            {renderOpt(lastOpt)}
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="flex justify-center mt-0.5">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                              {product.discountPercentage}% OFF
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <div className="text-sm sm:text-base line-through text-gray-500 dark:text-gray-400">${Number(product.price || 0).toFixed(2)}</div>
                          <div className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                            {product.discountPercentage}% OFF
                          </div>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                          ${(Number(product.price || 0) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                        ${Number(product.price || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                size="sm"
                className={`w-full font-semibold py-2 text-xs sm:text-sm transition-all duration-300 flex-shrink-0 ${
                  isOutOfStock
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700"
                    : "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                }`}
                variant={isOutOfStock ? "secondary" : "default"}
              >
                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Back of card */}
        <Card className="product-card-face product-card-back absolute inset-0 w-full h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-premium hover:shadow-premium-hover transition-all duration-500 ease-out flex flex-col rounded-2xl overflow-hidden">
          <div className="w-full h-1/2 overflow-hidden relative bg-gray-100 dark:bg-gray-800 flex-shrink-0 rounded-t-2xl group">
            <img
              src={currentImage}
              alt={product.name}
              className="w-full h-full object-cover object-center opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
            {hasMultipleImages && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 shadow-lg transition-all z-20 flex items-center justify-center backdrop-blur-sm opacity-70 hover:opacity-100"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 shadow-lg transition-all z-20 flex items-center justify-center backdrop-blur-sm opacity-70 hover:opacity-100"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-black/20 px-2 py-1.5 rounded-full backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity">
                  {productImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                      }}
                      className={`rounded-full transition-all ${
                        index === currentImageIndex
                          ? "bg-white/90 w-2.5 h-2.5"
                          : "bg-white/40 w-2 h-2 hover:bg-white/60"
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="absolute top-2 right-2 bg-black/30 text-white text-xs px-2 py-1 rounded-full z-20 backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity">
                  {currentImageIndex + 1} / {productImages.length}
                </div>
              </>
            )}
          </div>
          <CardContent className="pt-2 pb-3 px-3 sm:pt-2 sm:pb-4 sm:px-4 bg-white dark:bg-gray-900 flex flex-col min-h-0 flex-1 overflow-hidden rounded-b-2xl">
            <div className="text-center flex-shrink-0 mb-2 h-[3.5rem] flex items-center justify-center">
              <h4 
                className={`${needsSmallerText ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} text-purple-600 dark:text-purple-400 line-clamp-2 uppercase tracking-wide`}
                style={{ fontFamily: '"Fredoka One", "Bungee", "Chewy", "Modak", cursive, sans-serif' }}
              >
                {product.name}
              </h4>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div
                className="bg-gray-50 dark:bg-gray-800 p-2 sm:p-3 rounded-lg overflow-y-auto max-h-28 sm:max-h-32"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {product.description || "No description available"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add to Cart Modal */}
      <AddToCartModal
        open={showAddToCartModal}
        onOpenChange={setShowAddToCartModal}
        product={product}
      />
    </div>
  );
}