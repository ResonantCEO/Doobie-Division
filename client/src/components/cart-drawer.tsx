import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/contexts/cart-context";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, Minus, Plus, Trash2, CreditCard } from "lucide-react";

interface CartDrawerProps {
  children: React.ReactNode;
}

export default function CartDrawer({ children }: CartDrawerProps) {
  const { state, removeItem, updateQuantity, clearCart } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false); // Added state for checkout process
  const [shippingForm, setShippingForm] = useState({
    customerName: "",
    customerPhone: "",
    shippingAddress: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Auto-fill form with user data when confirmation modal opens
  useEffect(() => {
    if (showConfirmation && user) {
      const fullName = `${user.firstName} ${user.lastName}`;
      const address = [user.address, user.city, user.state, user.postalCode, user.country]
        .filter(Boolean)
        .join(", ");

      setShippingForm(prev => ({
        ...prev,
        customerName: fullName,
        shippingAddress: address,
      }));
    }
  }, [showConfirmation, user]);

  const handleQuantityChange = (productId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!shippingForm.customerName.trim()) {
      errors.customerName = "Full name is required";
    }
    if (!shippingForm.customerPhone.trim()) {
      errors.customerPhone = "Phone number is required";
    }
    if (!shippingForm.shippingAddress.trim()) {
      errors.shippingAddress = "Shipping address is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCheckout = async () => {
    if (state.items.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add some items to your cart before checking out.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingOut(true);

    try {
      // Validate stock for all items before checkout
      const stockValidation = await Promise.all(
        state.items.map(async (item) => {
          const response = await fetch(`/api/products/${item.product.id}`);
          if (!response.ok) throw new Error('Failed to check stock');
          const product = await response.json();
          return {
            item,
            product,
            hasStock: product.stock >= item.quantity
          };
        })
      );

      const outOfStockItems = stockValidation.filter(v => !v.hasStock);

      if (outOfStockItems.length > 0) {
        toast({
          title: "Stock Issue",
          description: `Some items in your cart are no longer available with the requested quantity. Please update your cart.`,
          variant: "destructive",
        });
        setIsCheckingOut(false);
        return;
      }

      // Proceed with checkout if all items have sufficient stock
      setShowConfirmation(true);
      setIsCheckingOut(false); // Reset checkout state when opening confirmation

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate stock. Please try again.",
        variant: "destructive",
      });
      setIsCheckingOut(false);
    }
  };


  const handleConfirmOrder = async () => {
    const { customerName, customerPhone, shippingAddress } = shippingForm;

    if (!validateForm()) {
      return;
    }

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;

      // Prepare order data
      const orderData = {
        orderNumber,
        customerId: user?.id,
        customerName,
        customerEmail: user?.email || "",
        customerPhone,
        shippingAddress,
        total: state.total.toString(),
        paymentMethod: "cod",
        notes: shippingForm.notes,
      };

      const orderItems = state.items.map(item => {
        const itemPrice = item.product.sellingMethod === "weight"
          ? Number(item.product.pricePerGram) || 0
          : Number(item.product.price) || 0;

        return {
          productId: item.product.id,
          productName: item.product.name,
          productPrice: itemPrice.toString(),
          quantity: item.quantity,
          subtotal: (itemPrice * item.quantity).toString(),
        };
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: orderData,
          items: orderItems,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        clearCart();
        setIsOpen(false);
        setShowConfirmation(false);
        setShippingForm({
          customerName: "",
          customerPhone: "",
          shippingAddress: "",
          notes: "",
        });
        setFormErrors({}); // Clear form errors on successful order
        setIsCheckingOut(false); // Reset checkout state after successful order

        toast({
          title: "Order placed successfully!",
          description: `Order #${responseData.orderNumber} has been created. You'll receive a confirmation email shortly.`,
        });
      } else {
        const errorData = await response.json();
        console.error("Order creation failed:", errorData);
        setIsCheckingOut(false); // Reset checkout state on order failure
        // Don't show toast, form validation will handle highlighting missing fields
      }
    } catch (error) {
      console.error('Order creation failed:', error);
      setIsCheckingOut(false); // Reset checkout state on catch error
      // Don't show toast, form validation will handle highlighting missing fields
    }
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
                      <div className="mt-1">
                        {item.product.sellingMethod === "weight" ? (
                          <div className="space-y-1">
                            {item.product.pricePerGram && (
                              <div className="font-semibold text-primary">${item.product.pricePerGram}/g</div>
                            )}
                            {item.product.pricePerOunce && (
                              <div className="text-sm text-gray-600">${item.product.pricePerOunce}/oz</div>
                            )}
                          </div>
                        ) : (
                          <p className="font-semibold text-primary">
                            ${Number(item.product.price || 0).toFixed(2)}
                          </p>
                        )}
                      </div>

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
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={item.quantity >= item.product.stock} // Disable if quantity reaches stock
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
                        Subtotal: ${(item.product.sellingMethod === "weight"
                          ? (Number(item.product.pricePerGram) || 0) * item.quantity
                          : (Number(item.product.price) || 0) * item.quantity
                        ).toFixed(2)}
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
                  <span className="text-primary">Free! Tips for our drivers are always appreciated.</span>
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
                  disabled={isCheckingOut} // Disable button during checkout process
                >
                  {isCheckingOut ? "Processing..." : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Proceed to Checkout
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="w-full"
                  disabled={isCheckingOut} // Disable button during checkout process
                >
                  Clear Cart
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>

      {/* Order Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirm Your Order</DialogTitle>
            <DialogDescription>
              Please review your order details and provide shipping information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Order Summary</h4>
              <div className="space-y-1 text-sm">
                {state.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between">
                    <span>{item.product.name} x {item.quantity}</span>
                    <span>${(item.product.sellingMethod === "weight"
                      ? (Number(item.product.pricePerGram) || 0) * item.quantity
                      : (Number(item.product.price) || 0) * item.quantity
                    ).toFixed(2)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${state.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Information Form */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="customerName">Full Name *</Label>
                <Input
                  id="customerName"
                  value={shippingForm.customerName}
                  onChange={(e) => {
                    setShippingForm(prev => ({ ...prev, customerName: e.target.value }));
                    if (formErrors.customerName) {
                      setFormErrors(prev => ({ ...prev, customerName: "" }));
                    }
                  }}
                  placeholder="Enter your full name"
                  className={formErrors.customerName ? "border-red-500 focus:border-red-500" : ""}
                  required
                />
                {formErrors.customerName && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.customerName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={shippingForm.customerPhone}
                  onChange={(e) => {
                    setShippingForm(prev => ({ ...prev, customerPhone: e.target.value }));
                    if (formErrors.customerPhone) {
                      setFormErrors(prev => ({ ...prev, customerPhone: "" }));
                    }
                  }}
                  placeholder="Enter your phone number"
                  className={formErrors.customerPhone ? "border-red-500 focus:border-red-500" : ""}
                  required
                />
                {formErrors.customerPhone && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.customerPhone}</p>
                )}
              </div>

              <div>
                <Label htmlFor="shippingAddress">Shipping Address *</Label>
                <Textarea
                  id="shippingAddress"
                  value={shippingForm.shippingAddress}
                  onChange={(e) => {
                    setShippingForm(prev => ({ ...prev, shippingAddress: e.target.value }));
                    if (formErrors.shippingAddress) {
                      setFormErrors(prev => ({ ...prev, shippingAddress: "" }));
                    }
                  }}
                  placeholder="Enter your complete shipping address including street, city, province, and postal code"
                  rows={3}
                  className={formErrors.shippingAddress ? "border-red-500 focus:border-red-500" : ""}
                  required
                />
                {formErrors.shippingAddress && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.shippingAddress}</p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Special Instructions (Optional)</Label>
                <Textarea
                  id="notes"
                  value={shippingForm.notes}
                  onChange={(e) => setShippingForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any special delivery instructions or notes"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOrder} disabled={isCheckingOut}>
              {isCheckingOut ? "Processing..." : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Confirm Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}