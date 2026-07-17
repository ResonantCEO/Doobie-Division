
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Product, Category } from "@shared/schema";

interface QuantityTier {
  minQuantity: number;
  pricePerItem: string;
}

interface CartItem {
  product: Product & { category: Category | null; quantityPricing?: QuantityTier[] };
  quantity: number;
  size?: string;
  isFree?: boolean;
  customPrice?: number;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string } }
  | { type: 'ADD_FREE_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string } }
  | { type: 'ADD_DISCOUNTED_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string; customPrice: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: number; size?: string; isFree?: boolean } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number; size?: string; isFree?: boolean } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

function getWeightOptionPrice(product: Product & { category: Category | null }, size?: string): number {
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
  return Number(product.pricePerGram) || 0;
}

function applyProductDiscount(product: any, price: number): number {
  const discPct = parseFloat(product.discountPercentage || "0");
  if (discPct > 0) return price * (1 - discPct / 100);
  const discAmt = parseFloat(product.discountAmount || "0");
  if (discAmt > 0) return Math.max(0, price - discAmt);
  return price;
}

function getItemPrice(product: Product & { category: Category | null }, size?: string): number {
  let price: number;
  if (product.sellingMethod === "weight") {
    price = getWeightOptionPrice(product, size);
  } else {
    price = Number(product.price) || 0;
  }
  return applyProductDiscount(product, price);
}

function getApplicableTierPrice(product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size: string | undefined, totalProductQty: number): number {
  const basePrice = getItemPrice(product, size);
  if ((product as any).bogoEnabled === true) return basePrice;
  const tiers = (product as any).quantityPricing as QuantityTier[] | undefined;
  if (!tiers || tiers.length === 0) return basePrice;
  const sortedTiers = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
  const applicable = sortedTiers.find(t => totalProductQty >= t.minQuantity);
  if (applicable) return Number(applicable.pricePerItem);
  return basePrice;
}

function computeTotal(items: CartItem[]): number {
  // Free items (isFree=true) don't contribute to total; discounted items use customPrice
  const paidItems = items.filter(i => !i.isFree);
  const productQtyMap = new Map<number, number>();
  for (const item of paidItems) {
    productQtyMap.set(item.product.id, (productQtyMap.get(item.product.id) || 0) + item.quantity);
  }
  return paidItems.reduce((sum, item) => {
    if (item.customPrice !== undefined) {
      return sum + item.customPrice * item.quantity;
    }
    const totalQty = productQtyMap.get(item.product.id) || item.quantity;
    return sum + getApplicableTierPrice(item.product, item.size, totalQty) * item.quantity;
  }, 0);
}

function makeItemKey(id: number, size?: string, isFree?: boolean): string {
  const base = size ? `${id}-${size}` : `${id}`;
  return isFree ? `${base}-free` : base;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const itemKey = makeItemKey(action.payload.product.id, action.payload.size, false);

      const existingItem = state.items.find(item => {
        if (item.isFree) return false;
        return makeItemKey(item.product.id, item.size, false) === itemKey;
      });

      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item => {
          if (item.isFree) return item;
          return makeItemKey(item.product.id, item.size, false) === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      } else {
        newItems = [...state.items, {
          product: action.payload.product,
          quantity: 1,
          size: action.payload.size,
          isFree: false,
        }];
      }

      const total = computeTotal(newItems);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      return { items: newItems, total, itemCount };
    }

    case 'ADD_FREE_ITEM': {
      const itemKey = makeItemKey(action.payload.product.id, action.payload.size, true);

      const existingItem = state.items.find(item => {
        if (!item.isFree) return false;
        return makeItemKey(item.product.id, item.size, true) === itemKey;
      });

      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item => {
          if (!item.isFree) return item;
          return makeItemKey(item.product.id, item.size, true) === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      } else {
        newItems = [...state.items, {
          product: action.payload.product,
          quantity: 1,
          size: action.payload.size,
          isFree: true,
        }];
      }

      const total = computeTotal(newItems);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      return { items: newItems, total, itemCount };
    }

    case 'ADD_DISCOUNTED_ITEM': {
      const itemKey = `${action.payload.product.id}-${action.payload.size || ''}-discounted`;
      const existingItem = state.items.find(item =>
        `${item.product.id}-${item.size || ''}-discounted` === itemKey && item.customPrice !== undefined
      );

      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item =>
          `${item.product.id}-${item.size || ''}-discounted` === itemKey && item.customPrice !== undefined
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [...state.items, {
          product: action.payload.product,
          quantity: 1,
          size: action.payload.size,
          isFree: false,
          customPrice: action.payload.customPrice,
        }];
      }

      const total = computeTotal(newItems);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      return { items: newItems, total, itemCount };
    }

    case 'REMOVE_ITEM': {
      const itemKey = makeItemKey(action.payload.id, action.payload.size, action.payload.isFree);

      const newItems = state.items.filter(item => {
        return makeItemKey(item.product.id, item.size, item.isFree) !== itemKey;
      });
      const total = computeTotal(newItems);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      return { items: newItems, total, itemCount };
    }

    case 'UPDATE_QUANTITY': {
      const itemKey = makeItemKey(action.payload.id, action.payload.size, action.payload.isFree);

      const newItems = state.items.map(item => {
        return makeItemKey(item.product.id, item.size, item.isFree) === itemKey
          ? { ...item, quantity: Math.max(0, action.payload.quantity) }
          : item;
      }).filter(item => item.quantity > 0);

      const total = computeTotal(newItems);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      return { items: newItems, total, itemCount };
    }

    case 'CLEAR_CART':
      return initialState;

    case 'LOAD_CART': {
      const total = computeTotal(action.payload);
      const itemCount = action.payload.reduce((sum, item) => sum + item.quantity, 0);
      return { items: action.payload, total, itemCount };
    }

    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size?: string) => void;
  addFreeItem: (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size?: string) => void;
  addDiscountedItem: (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size: string | undefined, customPrice: number) => void;
  removeItem: (productId: number, size?: string, isFree?: boolean) => void;
  updateQuantity: (productId: number, quantity: number, size?: string, isFree?: boolean) => void;
  clearCart: () => void;
  getEffectivePrice: (productId: number, size?: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const cartItems = JSON.parse(savedCart);

        const validateCart = async () => {
          try {
            const validatedItems: CartItem[] = [];
            for (const item of cartItems) {
              const response = await fetch(`/api/products/${item.product.id}`);
              if (!response.ok) continue;
              const freshProduct = await response.json();

              if (item.size && freshProduct.sizes && freshProduct.sizes.length > 0) {
                const sizeData = freshProduct.sizes.find((s: any) => s.size === item.size);
                if (sizeData && sizeData.quantity > 0) {
                  validatedItems.push({
                    ...item,
                    product: freshProduct,
                    quantity: Math.min(item.quantity, sizeData.quantity),
                  });
                }
              } else if (freshProduct.stock > 0) {
                validatedItems.push({
                  ...item,
                  product: freshProduct,
                  quantity: Math.min(item.quantity, freshProduct.stock),
                });
              }
            }
            dispatch({ type: 'LOAD_CART', payload: validatedItems });
          } catch {
            dispatch({ type: 'LOAD_CART', payload: cartItems });
          }
        };

        validateCart();
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size?: string) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, size } });
  };

  const addFreeItem = (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size?: string) => {
    dispatch({ type: 'ADD_FREE_ITEM', payload: { product, size } });
  };

  const addDiscountedItem = (product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }, size: string | undefined, customPrice: number) => {
    dispatch({ type: 'ADD_DISCOUNTED_ITEM', payload: { product, size, customPrice } });
  };

  const removeItem = (productId: number, size?: string, isFree?: boolean) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id: productId, size, isFree } });
  };

  const updateQuantity = (productId: number, quantity: number, size?: string, isFree?: boolean) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity, size, isFree } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getEffectivePrice = (productId: number, size?: string): number => {
    const productQtyMap = new Map<number, number>();
    for (const item of state.items) {
      if (!item.isFree) {
        productQtyMap.set(item.product.id, (productQtyMap.get(item.product.id) || 0) + item.quantity);
      }
    }
    const item = state.items.find(i => i.product.id === productId && i.size === size && !i.isFree);
    if (!item) return 0;
    const totalQty = productQtyMap.get(productId) || 0;
    return getApplicableTierPrice(item.product, size, totalQty);
  };

  return (
    <CartContext.Provider value={{ state, addItem, addFreeItem, addDiscountedItem, removeItem, updateQuantity, clearCart, getEffectivePrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export type { QuantityTier };
