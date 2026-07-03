import { useState, useEffect, useCallback } from "react";
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
import { ShoppingCart, Minus, Plus, Trash2, CreditCard, Tag, Gift, Upload, X, ImageIcon } from "lucide-react";

interface CartDrawerProps {
  children: React.ReactNode;
}

interface AppliedDiscount {
  discount: { id: number; name: string; type: string };
  savings: number;
  description: string;
  freeProductId?: number;
  freeProductQuantity?: number;
}

interface DiscountEvalResult {
  applied: AppliedDiscount[];
  totalSavings: number;
}

export default function CartDrawer({ children }: CartDrawerProps) {
  const { state, removeItem, updateQuantity, clearCart } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [discountResult, setDiscountResult] = useState<DiscountEvalResult | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ promoId: number; code: string; description?: string; discountType: string; discountValue: string; discountAmount: number; bypassPurchaseMinimum: boolean } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    customerName: "",
    customerPhone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [prePayPhotoFile, setPrePayPhotoFile] = useState<File | null>(null);
  const [prePayPhotoPreview, setPrePayPhotoPreview] = useState<string | null>(null);

  // Evaluate discounts whenever cart items change (debounced)
  useEffect(() => {
    if (!user || state.items.length === 0) {
      setDiscountResult(null);
      return;
    }
    const cartItems = state.items.map(item => ({
      productId: item.product.id,
      categoryId: item.product.categoryId,
      quantity: item.quantity,
      price: item.product.sellingMethod === 'weight'
        ? Number(item.product.pricePerGram) || 0
        : Number(item.product.price) || 0,
    }));
    fetch('/api/discounts/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items: cartItems }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDiscountResult(data); })
      .catch(() => {});
  }, [state.items, user]);

  // Auto-fill form with user data when confirmation modal opens
  useEffect(() => {
    if (showConfirmation && user) {
      const fullName = `${user.firstName} ${user.lastName}`;

      setShippingForm(prev => ({
        ...prev,
        customerName: fullName,
        street: user.address || "",
        city: user.city || "",
        state: user.state || "",
        zipCode: user.postalCode || "",
      }));
    }
  }, [showConfirmation, user]);

  const handleQuantityChange = (productId: number, newQuantity: number, size?: string, item?: typeof state.items[0]) => {
    if (newQuantity < 1) {
      removeItem(productId, size);
    } else {
      if (item && size && (item.product as any).sizes) {
        const sizeData = (item.product as any).sizes.find((s: any) => s.size === size);
        if (sizeData && newQuantity > sizeData.quantity) {
          toast({
            title: "Stock Limit",
            description: `Only ${sizeData.quantity} units available for size ${size}.`,
            variant: "destructive",
          });
          return;
        }
      } else if (item && newQuantity > item.product.stock) {
        toast({
          title: "Stock Limit",
          description: `Only ${item.product.stock} units available.`,
          variant: "destructive",
        });
        return;
      }
      updateQuantity(productId, newQuantity, size);
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
    if (!shippingForm.street.trim()) {
      errors.street = "Street address is required";
    }
    if (!shippingForm.city.trim()) {
      errors.city = "City is required";
    }
    if (!shippingForm.state.trim()) {
      errors.state = "State is required";
    }
    if (!shippingForm.zipCode.trim()) {
      errors.zipCode = "Zip code is required";
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
          
          // Check stock per size if item has a size
          let hasStock = false;
          if (item.size && product.sizes && product.sizes.length > 0) {
            const sizeData = product.sizes.find((s: any) => s.size === item.size);
            hasStock = sizeData ? sizeData.quantity >= item.quantity : false;
          } else {
            hasStock = product.stock >= item.quantity;
          }
          
          return {
            item,
            product,
            hasStock
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


  const applyPromoCode = async () => {
    if (!promoInput.trim()) return;
    setIsValidatingPromo(true);
    try {
      const effectiveTotal = state.total - (discountResult?.totalSavings || 0);
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: promoInput.trim(), cartTotal: effectiveTotal.toString() }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedPromo(data);
        toast({ title: `Promo code applied!`, description: data.discountType === 'percent' ? `${data.discountValue}% off your order` : `$${Number(data.discountAmount).toFixed(2)} off your order` });
      } else {
        toast({ title: "Invalid code", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not apply promo code.", variant: "destructive" });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleConfirmOrder = async (paymentMethod: "cod" | "prepay" = "cod", paymentPhotoUrl?: string) => {
    const { customerName, customerPhone, street, city, state: shippingState, zipCode } = shippingForm;

    if (!validateForm()) {
      return;
    }

    setIsCheckingOut(true);

    try {
      // Check purchase limit for city (skipped if promo code bypasses minimum)
      if (city.trim() && !appliedPromo?.bypassPurchaseMinimum) {
        const limitCheck = await fetch('/api/check-purchase-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            city: city.trim(),
            total: state.total.toString(),
            userId: user?.id,
          }),
        });
        const limitResult = await limitCheck.json();
        if (!limitResult.allowed) {
          if (limitResult.deliveryBlocked) {
            toast({
              title: "Delivery Not Available",
              description: `We're sorry, but we do not currently deliver to ${limitResult.cityName || city}. We apologize for the inconvenience and hope to serve your area in the future.`,
              variant: "destructive",
              duration: 8000,
            });
          } else {
            toast({
              title: "Minimum Order Not Met",
              description: `Orders shipping to ${limitResult.cityName || city} require a minimum of $${limitResult.minimumAmount?.toFixed(2)}. Your current total is $${state.total.toFixed(2)}.`,
              variant: "destructive",
            });
          }
          setIsCheckingOut(false);
          return;
        }
      }
    } catch (error) {
      console.error('Purchase limit check failed:', error);
      toast({
        title: "Error",
        description: "Could not verify purchase limit requirements. Please try again.",
        variant: "destructive",
      });
      setIsCheckingOut(false);
      return;
    }

    const shippingAddress = [street, city, shippingState, zipCode].filter(Boolean).join(", ");

    try {
      // Generate order number
      const orderNumber = `ORD-${Date.now()}`;

      // Prepare order data (apply promo discount if any)
      const promoSavings = appliedPromo?.discountAmount || 0;
      const finalTotal = Math.max(0, state.total - (discountResult?.totalSavings || 0) - promoSavings);
      const orderData: any = {
        orderNumber,
        customerId: user?.id,
        customerName,
        customerEmail: user?.email || "",
        customerPhone,
        shippingAddress,
        total: finalTotal.toFixed(2),
        paymentMethod,
        paymentPhotoUrl: paymentPhotoUrl || null,
        notes: shippingForm.notes,
      };
      orderData.originalTotal = state.total.toFixed(2);
      if (appliedPromo) {
        orderData.promoCodeId = appliedPromo.promoId;
        orderData.promoCode = appliedPromo.code;
        orderData.promoDiscount = promoSavings.toFixed(2);
      }

      // Helper function to get price based on weight option size
      const getWeightOptionPrice = (product: typeof state.items[0]['product'], size?: string): number => {
        if (!size) {
          return Number(product.pricePerGram) || 0;
        }
        
        const normalizedSize = size.toLowerCase().trim();
        
        if (normalizedSize.includes('1/8') || normalizedSize.includes('⅛')) {
          return Number((product as any).pricePerEighth) || 0;
        }
        if (normalizedSize.includes('1/4') || normalizedSize.includes('¼')) {
          return Number((product as any).pricePerQuarter) || 0;
        }
        if (normalizedSize.includes('1/2') || normalizedSize.includes('½')) {
          return Number((product as any).pricePerHalf) || 0;
        }
        if (normalizedSize.includes('1 oz') || normalizedSize === '1 oz' || normalizedSize === 'ounce') {
          return Number(product.pricePerOunce) || 0;
        }
        // Default to grams
        return Number(product.pricePerGram) || 0;
      };

      const orderItems = state.items.map(item => {
        const itemPrice = item.product.sellingMethod === "weight"
          ? getWeightOptionPrice(item.product, item.size)
          : Number(item.product.price) || 0;

        const productName = item.size 
          ? `${item.product.name} (Size: ${item.size})`
          : item.product.name;

        return {
          productId: item.product.id,
          productName: productName,
          productPrice: itemPrice.toString(),
          quantity: item.quantity,
          subtotal: (itemPrice * item.quantity).toString(),
          size: item.size, // Include size in order item
        };
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        setShippingForm({ customerName: "", customerPhone: "", street: "", city: "", state: "", zipCode: "", notes: "" });
        setFormErrors({});
        setPromoInput("");
        setAppliedPromo(null);
        setIsCheckingOut(false);

        toast({
          title: "Order placed successfully!",
          description: `Order #${responseData.orderNumber} has been created. You'll receive a confirmation email shortly.`,
        });
      } else {
        const errorData = await response.json();
        console.error("Order creation failed:", errorData);
        setIsCheckingOut(false);
        toast({
          title: "Order Failed",
          description: errorData?.message || "Failed to create order. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Order creation failed:', error);
      setIsCheckingOut(false);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrePayOrder = async () => {
    if (!prePayPhotoFile) {
      toast({ title: "Photo Required", description: "Please attach a payment photo to pre-pay.", variant: "destructive" });
      return;
    }
    setIsCheckingOut(true);
    try {
      const formData = new FormData();
      formData.append("photo", prePayPhotoFile);
      const uploadRes = await fetch("/api/upload/payment-photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload payment photo");
      const { photoUrl } = await uploadRes.json();
      setIsCheckingOut(false);
      await handleConfirmOrder("prepay", photoUrl);
    } catch (error) {
      console.error("Pre-pay photo upload failed:", error);
      toast({ title: "Upload Failed", description: "Could not upload payment photo. Please try again.", variant: "destructive" });
      setIsCheckingOut(false);
    }
  };

  const handlePrePayPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrePayPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPrePayPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
                {state.items.map((item, index) => {
                  const itemKey = item.size ? `${item.product.id}-${item.size}-${index}` : `${item.product.id}-${index}`;
                  return (
                  <div key={itemKey} className="flex items-start gap-4 p-4 border rounded-lg">
                    <img
                      src={item.product.imageUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop"}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{item.product.name}</h4>
                      {item.size && (
                        <p className="text-xs font-semibold text-primary">Size: {item.size}</p>
                      )}
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
                          onClick={() => handleQuantityChange(item.product.id, item.quantity - 1, item.size, item)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1, item.size, item)}
                          className="h-8 w-16 text-center"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={
                            item.size 
                              ? (item.product as any).sizes?.find((s: any) => s.size === item.size)?.quantity <= item.quantity
                              : item.quantity >= item.product.stock
                          }
                          onClick={() => handleQuantityChange(item.product.id, item.quantity + 1, item.size, item)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.product.id, item.size)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Subtotal */}
                      <p className="text-sm font-medium mt-2">
                        Subtotal: ${(() => {
                          if (item.product.sellingMethod === "weight") {
                            const normalizedSize = (item.size || '').toLowerCase().trim();
                            let price = 0;
                            
                            if (normalizedSize.includes('1/8') || normalizedSize.includes('⅛')) {
                              price = Number((item.product as any).pricePerEighth) || 0;
                            } else if (normalizedSize.includes('1/4') || normalizedSize.includes('¼')) {
                              price = Number((item.product as any).pricePerQuarter) || 0;
                            } else if (normalizedSize.includes('1/2') || normalizedSize.includes('½')) {
                              price = Number((item.product as any).pricePerHalf) || 0;
                            } else if (normalizedSize.includes('1 oz') || normalizedSize === '1 oz' || normalizedSize === 'ounce') {
                              price = Number(item.product.pricePerOunce) || 0;
                            } else {
                              price = Number(item.product.pricePerGram) || 0;
                            }
                            return (price * item.quantity).toFixed(2);
                          } else {
                            return ((Number(item.product.price) || 0) * item.quantity).toFixed(2);
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                  );
                })}
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
                {/* Applied automatic discounts */}
                {discountResult && discountResult.applied.length > 0 && (
                  <div className="space-y-1">
                    {discountResult.applied.map((a, i) => (
                      <div key={i} className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span className="flex items-center gap-1">
                          {a.freeProductId ? <Gift className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
                          {a.discount.name}
                        </span>
                        <span>{a.savings > 0 ? `-$${a.savings.toFixed(2)}` : a.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Applied promo code */}
                {appliedPromo && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Promo: <span className="font-mono font-bold ml-1">{appliedPromo.code}</span>
                    </span>
                    <span>-${appliedPromo.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span className="text-primary">Free! Tips for our drivers are always appreciated.</span>
                </div>
                <Separator />
                {(() => {
                  const autoSavings = discountResult?.totalSavings || 0;
                  const promoSavings = appliedPromo?.discountAmount || 0;
                  const totalSavings = autoSavings + promoSavings;
                  const finalTotal = Math.max(0, state.total - totalSavings);
                  return (
                    <>
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>
                          {totalSavings > 0 ? (
                            <span className="flex items-center gap-2">
                              <span className="line-through text-gray-400 text-sm font-normal">${state.total.toFixed(2)}</span>
                              <span className="text-green-600 dark:text-green-400">${finalTotal.toFixed(2)}</span>
                            </span>
                          ) : `$${state.total.toFixed(2)}`}
                        </span>
                      </div>
                      {totalSavings > 0 && (
                        <div className="text-xs text-green-600 dark:text-green-400 text-right">You save ${totalSavings.toFixed(2)}!</div>
                      )}
                    </>
                  );
                })()}
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Confirm Your Order</DialogTitle>
            <DialogDescription>
              Please review your order details and provide shipping information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {/* Order Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Order Summary</h4>
              <div className="space-y-1 text-sm">
                {state.items.map((item, index) => {
                  const itemKey = item.size ? `${item.product.id}-${item.size}-${index}` : `${item.product.id}-${index}`;
                  return (
                  <div key={itemKey} className="flex justify-between">
                    <span>
                      {item.product.name}
                      {item.size && <span className="text-xs text-muted-foreground"> (Size: {item.size})</span>}
                      {' '}x {item.quantity}
                    </span>
                    <span>${(item.product.sellingMethod === "weight"
                      ? (Number(item.product.pricePerGram) || 0) * item.quantity
                      : (Number(item.product.price) || 0) * item.quantity
                    ).toFixed(2)}</span>
                  </div>
                  );
                })}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${state.total.toFixed(2)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between font-semibold text-green-600 dark:text-green-400 mt-1">
                    <span>Total after promo</span>
                    <span>${Math.max(0, state.total - appliedPromo.discountAmount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Promo Code */}
            <div className="space-y-2">
              {appliedPromo ? (
                <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <span className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span className="font-mono font-bold">{appliedPromo.code}</span> applied — saves ${appliedPromo.discountAmount.toFixed(2)}
                    {appliedPromo.bypassPurchaseMinimum && <span className="text-xs opacity-70">(min. bypassed)</span>}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setAppliedPromo(null); setPromoInput(""); }}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Promo code"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && applyPromoCode()}
                    className="font-mono uppercase text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={applyPromoCode} disabled={isValidatingPromo || !promoInput.trim()}>
                    {isValidatingPromo ? "..." : "Apply"}
                  </Button>
                </div>
              )}
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
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  value={shippingForm.street}
                  onChange={(e) => {
                    setShippingForm(prev => ({ ...prev, street: e.target.value }));
                    if (formErrors.street) {
                      setFormErrors(prev => ({ ...prev, street: "" }));
                    }
                  }}
                  placeholder="123 Main St, Apt 4"
                  className={formErrors.street ? "border-red-500 focus:border-red-500" : ""}
                  required
                />
                {formErrors.street && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.street}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={shippingForm.city}
                    onChange={(e) => {
                      setShippingForm(prev => ({ ...prev, city: e.target.value }));
                      if (formErrors.city) {
                        setFormErrors(prev => ({ ...prev, city: "" }));
                      }
                    }}
                    placeholder="City"
                    className={formErrors.city ? "border-red-500 focus:border-red-500" : ""}
                    required
                  />
                  {formErrors.city && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.city}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={shippingForm.state}
                    onChange={(e) => {
                      setShippingForm(prev => ({ ...prev, state: e.target.value }));
                      if (formErrors.state) {
                        setFormErrors(prev => ({ ...prev, state: "" }));
                      }
                    }}
                    placeholder="State"
                    className={formErrors.state ? "border-red-500 focus:border-red-500" : ""}
                    required
                  />
                  {formErrors.state && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.state}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="zipCode">Zip Code *</Label>
                  <Input
                    id="zipCode"
                    value={shippingForm.zipCode}
                    onChange={(e) => {
                      setShippingForm(prev => ({ ...prev, zipCode: e.target.value }));
                      if (formErrors.zipCode) {
                        setFormErrors(prev => ({ ...prev, zipCode: "" }));
                      }
                    }}
                    placeholder="12345"
                    className={formErrors.zipCode ? "border-red-500 focus:border-red-500" : ""}
                    required
                  />
                  {formErrors.zipCode && (
                    <p className="text-sm text-red-500 mt-1">{formErrors.zipCode}</p>
                  )}
                </div>
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

            {/* Pre-Pay Photo Upload Section */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Pre-Pay Photo (optional)</p>
              </div>
              <p className="text-xs text-muted-foreground">Attach a payment photo if you'd like to pre-pay your order.</p>
              {prePayPhotoPreview ? (
                <div className="relative inline-block">
                  <img src={prePayPhotoPreview} alt="Payment" className="h-32 w-auto rounded-md object-cover border" />
                  <button
                    type="button"
                    onClick={() => { setPrePayPhotoFile(null); setPrePayPhotoPreview(null); }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-md p-3 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>Click to attach photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePrePayPhotoChange} />
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={isCheckingOut}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConfirmOrder("cod")}
              disabled={isCheckingOut}
              className="flex-1"
            >
              {isCheckingOut ? "Processing..." : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Pay Upon Arrival
                </>
              )}
            </Button>
            <Button
              onClick={handlePrePayOrder}
              disabled={isCheckingOut || !prePayPhotoFile}
              className="flex-1"
            >
              {isCheckingOut ? "Processing..." : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pre-Pay
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}