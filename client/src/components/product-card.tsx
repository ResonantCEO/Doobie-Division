import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category } from "@shared/schema";

interface ProductCardProps {
  product: Product & { category: Category | null };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();

  const handleAddToCart = () => {
    if (product.stock === 0) return;
    
    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const getStockStatus = () => {
    if (product.stock === 0) {
      return { label: "Out of Stock", variant: "destructive" as const };
    }
    if (product.stock <= product.minStockThreshold) {
      return { label: `Low Stock (${product.stock})`, variant: "secondary" as const };
    }
    return { label: `In Stock (${product.stock})`, variant: "default" as const };
  };

  const stockStatus = getStockStatus();

  return (
    <Card className="product-card overflow-hidden">
      <div className="aspect-square overflow-hidden">
        <img
          src={product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop"}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-gray-900 line-clamp-1">{product.name}</h4>
          {product.category && (
            <p className="text-sm text-gray-500">{product.category.name}</p>
          )}
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{product.description}</p>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">
            ${Number(product.price).toFixed(2)}
          </span>
          <Badge variant={stockStatus.variant === "destructive" ? "destructive" : stockStatus.variant === "secondary" ? "secondary" : "outline"}>
            {stockStatus.label}
          </Badge>
        </div>
        
        <Button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="w-full"
          variant={product.stock === 0 ? "secondary" : "default"}
        >
          {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
        </Button>
      </CardContent>
    </Card>
  );
}
