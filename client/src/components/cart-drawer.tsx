
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/contexts/cart-context";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Minus, Plus, Trash2, CreditCard } from "lucide-react";

interface CartDrawerProps {
  children: React.ReactNode;
}

export default function CartDrawer({ children }: CartDrawerProps) {
  const { state, removeItem, updateQuantity, clearCart } = useCart();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleQuantityChange = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleCheckout = () => {
    if (state.items.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add some items to your cart before checking out.",
        variant: "destructive",
      });
      return;
    }

    // Simulate checkout process
    toast({
      title: "Checkout initiated",
      description: `Processing ${state.itemCount} items worth $${state.total.toFixed(2)}`,
    });
    
    // In a real app, you'd redirect to a payment processor
    // For demo purposes, we'll just clear the cart after a delay
    setTimeout(() => {
      clearCart();
      setIsOpen(false);
      toast({
        title: "Order placed successfully!",
        description: "Thank you for your purchase. You'll receive a confirmation email shortly.",
      });
    }, 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shopping Cart
            {state.itemCount > 0 && (
              <Badge variant="secondary">{state.itemCount} items</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {state.items.length === 0 
              ? "Your cart is empty. Start shopping to add items!"
              : "Review your items and proceed to checkout"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto py-4">
            {state.items.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Your cart is empty</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsOpen(false)}
                >
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {state.items.map((item) => (
                  <div key={item.product.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <img
                      src={item.product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop"}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{item.product.name}</h4>
                      {item.product.category && (
                        <p className="text-xs text-muted-foreground">{item.product.category.name}</p>
                      )}
                      <p className="font-semibold text-primary mt-1">
                        ${Number(item.product.price).toFixed(2)}
                      </p>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max={item.product.stock}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={item.quantity >= item.product.stock}
                          onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Subtotal */}
                      <p className="text-sm font-medium mt-2">
                        Subtotal: ${(Number(item.product.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary and Actions */}
          {state.items.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Items ({state.itemCount})</span>
                  <span>${state.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span className="text-primary">Free</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${state.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleCheckout}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Checkout
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearCart}
                  className="w-full"
                >
                  Clear Cart
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
