import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/cart-context";
import { useState } from "react";
import AddToCartModal from "./add-to-cart-modal";
import type { Product, Category } from "@shared/schema";

interface ProductCardProps {
  product: Product & { category: Category | null };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();
  const { addItem } = useCart();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card flip when clicking button
    if (product.stock === 0) return;

    setShowAddToCartModal(true);
  };

  const getStockStatus = () => {
    if (product.stock === 0) {
      return { label: "Out of Stock", variant: "destructive" as const };
    }
    if (product.stock <= product.minStockThreshold) {
      return { label: `Low Stock (${product.stock})`, variant: "secondary" as const };
    }
    return null; // Don't show badge for in-stock items
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
        <Card className="product-card-face product-card-front absolute inset-0 w-full h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-premium hover:shadow-premium-hover transition-all duration-500 ease-out flex flex-col backface-hidden transform hover:-translate-y-1 rounded-2xl">
          <div className="w-full h-32 sm:h-40 md:h-48 overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 rounded-t-2xl">
            <img
              src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop"}
              alt={product.name}
              className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-300"
            />
          </div>
          <CardContent className="p-2 sm:p-3 md:p-4 bg-white dark:bg-gray-900 flex flex-col flex-1 rounded-b-2xl">
            <div className="flex-1 text-center">
              <h4 className="font-bold text-base sm:text-lg md:text-xl text-purple-600 dark:text-purple-400 line-clamp-1 mb-1 uppercase tracking-wide" style={{ fontFamily: '"Fredoka One", "Bungee", "Chewy", "Modak", cursive, sans-serif' }}>{product.name}</h4>
              {(product as any).company && (
                <p className="text-sm sm:text-base font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">{(product as any).company}</p>
              )}
              {product.category && (
                <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">{product.category.name}</p>
              )}
            </div>

            <div className="mt-2 sm:mt-3 md:mt-4 space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  {product.sellingMethod === "weight" ? (
                    <div className="space-y-1">
                      {product.pricePerGram && (
                        <div>
                          {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                            <div className="space-y-1">
                              <div className="text-sm line-through text-gray-500 dark:text-gray-400">${product.pricePerGram}/g</div>
                              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                                ${(parseFloat(product.pricePerGram) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}/g
                              </div>
                              <div className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full inline-block">
                                {product.discountPercentage}% OFF
                              </div>
                            </div>
                          ) : (
                            <div className="text-xl font-bold text-gray-900 dark:text-white">${product.pricePerGram}/g</div>
                          )}
                        </div>
                      )}
                      {product.pricePerOunce && (
                        <div>
                          {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <span className="line-through">${product.pricePerOunce}/oz</span>
                              <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">
                                ${(parseFloat(product.pricePerOunce) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}/oz
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">${product.pricePerOunce}/oz</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {product.discountPercentage && parseFloat(product.discountPercentage) > 0 ? (
                        <div className="space-y-1">
                          <div className="text-lg line-through text-gray-500 dark:text-gray-400">${Number(product.price || 0).toFixed(2)}</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ${(Number(product.price || 0) * (1 - parseFloat(product.discountPercentage) / 100)).toFixed(2)}
                          </div>
                          <div className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full inline-block">
                            {product.discountPercentage}% OFF
                          </div>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${Number(product.price || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {stockStatus && (
                  <div className="ml-3">
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
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                size="sm"
                className={`w-full font-semibold py-2 sm:py-3 text-xs sm:text-sm transition-all duration-300 ${
                  product.stock === 0
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700"
                    : "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                }`}
                variant={product.stock === 0 ? "secondary" : "default"}
              >
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Back of card */}
        <Card className="product-card-face product-card-back absolute inset-0 w-full h-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-premium hover:shadow-premium-hover transition-all duration-500 ease-out flex flex-col backface-hidden rotate-y-180 transform hover:-translate-y-1 rounded-2xl">
          <div className="w-full h-48 overflow-hidden relative bg-gray-100 dark:bg-gray-800 flex-shrink-0 rounded-t-2xl">
            <img
              src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop"}
              alt={product.name}
              className="w-full h-full object-cover object-center opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
          </div>
          <CardContent className="p-4 bg-white dark:bg-gray-900 flex flex-col min-h-0 flex-1 overflow-y-auto rounded-b-2xl">
            <div className="flex-grow text-center">
              <h4 className="font-bold text-xl text-purple-600 dark:text-purple-400 line-clamp-1 mb-1 uppercase tracking-wide" style={{ fontFamily: '"Fredoka One", "Bungee", "Chewy", "Modak", cursive, sans-serif' }}>{product.name}</h4>
              {(product as any).company && (
                <p className="text-base font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-2">{(product as any).company}</p>
              )}
              {product.category && (
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">{product.category.name}</p>
              )}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {product.description || "No description available"}
                </p>
              </div>
            </div>

            {stockStatus && (
              <div className="mt-4 flex-shrink-0">
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
              </div>
            )}
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