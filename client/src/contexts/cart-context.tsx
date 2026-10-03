
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Product, Category } from "@shared/schema";
import { priceCartItems, type ItemPricing } from "@shared/cart-pricing";
import { useAuth } from "@/hooks/useAuth";

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

export interface CgBagCartItem {
  cartId: string; // unique id for this entry, e.g. `cg-${templateId}-${timestamp}`
  templateId: number;
  templateName: string;
  sellingPrice: number;
  selectedCategoryIds: number[];
  categoryNames: string[];
}

interface CartState {
  items: CartItem[];
  cgBagItems: CgBagCartItem[];
  total: number;
  cgBagTotal: number;
  itemCount: number;
  globalWeightPricing: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string } }
  | { type: 'ADD_FREE_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string } }
  | { type: 'ADD_DISCOUNTED_ITEM'; payload: { product: Product & { category: Category | null; quantityPricing?: QuantityTier[] }; size?: string; customPrice: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: number; size?: string; isFree?: boolean } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number; size?: string; isFree?: boolean } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] }
  | { type: 'LOAD_CG_BAGS'; payload: CgBagCartItem[] }
  | { type: 'SET_WEIGHT_PRICING'; payload: boolean }
  | { type: 'ADD_CG_BAG'; payload: CgBagCartItem }
  | { type: 'REMOVE_CG_BAG'; payload: { cartId: string } };

const initialState: CartState = {
  items: [],
  cgBagItems: [],
  total: 0,
  cgBagTotal: 0,
  itemCount: 0,
  globalWeightPricing: true,
};

export { sizeToGrams, getWeightTier, getWeightItemEffectivePrice, greedyOzBucketPricing } from "@shared/cart-pricing";
export type { WeightTier } from "@shared/cart-pricing";

function computeTotal(items: CartItem[], globalWeightPricing: boolean): number {
  return priceCartItems(items, globalWeightPricing).reduce((sum, price) => sum + price.subtotal, 0);
}

function makeItemKey(id: number, size?: string, isFree?: boolean): string {
  const base = size ? `${id}-${size}` : `${id}`;
  return isFree ? `${base}-free` : base;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_WEIGHT_PRICING': {
      const total = computeTotal(state.items, action.payload);
      return { ...state, globalWeightPricing: action.payload, total };
    }

    case 'ADD_CG_BAG': {
      const newCgBagItems = [...state.cgBagItems, action.payload];
      const cgBagTotal = newCgBagItems.reduce((s, b) => s + b.sellingPrice, 0);
      const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0) + newCgBagItems.length;
      return { ...state, cgBagItems: newCgBagItems, cgBagTotal, itemCount };
    }

    case 'REMOVE_CG_BAG': {
      const newCgBagItems = state.cgBagItems.filter(b => b.cartId !== action.payload.cartId);
      const cgBagTotal = newCgBagItems.reduce((s, b) => s + b.sellingPrice, 0);
      const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0) + newCgBagItems.length;
      return { ...state, cgBagItems: newCgBagItems, cgBagTotal, itemCount };
    }

    case 'LOAD_CG_BAGS': {
      const cgBagTotal = action.payload.reduce((s, b) => s + b.sellingPrice, 0);
      const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0) + action.payload.length;
      return { ...state, cgBagItems: action.payload, cgBagTotal, itemCount };
    }

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

      const total = computeTotal(newItems, state.globalWeightPricing);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: newItems, total, itemCount };
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

      const total = computeTotal(newItems, state.globalWeightPricing);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: newItems, total, itemCount };
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

      const total = computeTotal(newItems, state.globalWeightPricing);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: newItems, total, itemCount };
    }

    case 'REMOVE_ITEM': {
      const itemKey = makeItemKey(action.payload.id, action.payload.size, action.payload.isFree);

      let newItems = state.items.filter(item => {
        return makeItemKey(item.product.id, item.size, item.isFree) !== itemKey;
      });

      if (!action.payload.isFree) {
        const freeKey = makeItemKey(action.payload.id, action.payload.size, true);
        newItems = newItems.filter(item =>
          makeItemKey(item.product.id, item.size, item.isFree) !== freeKey
        );
      }

      const total = computeTotal(newItems, state.globalWeightPricing);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: newItems, total, itemCount };
    }

    case 'UPDATE_QUANTITY': {
      const itemKey = makeItemKey(action.payload.id, action.payload.size, action.payload.isFree);

      const newItems = state.items.map(item => {
        return makeItemKey(item.product.id, item.size, item.isFree) === itemKey
          ? { ...item, quantity: Math.max(0, action.payload.quantity) }
          : item;
      }).filter(item => item.quantity > 0);

      const total = computeTotal(newItems, state.globalWeightPricing);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: newItems, total, itemCount };
    }

    case 'CLEAR_CART':
      return { ...initialState, globalWeightPricing: state.globalWeightPricing };

    case 'LOAD_CART': {
      const total = computeTotal(action.payload, state.globalWeightPricing);
      const cgBagTotal = state.cgBagItems.reduce((s, b) => s + b.sellingPrice, 0);
      const itemCount = action.payload.reduce((sum, item) => sum + item.quantity, 0) + state.cgBagItems.length;
      return { ...state, items: action.payload, total, cgBagTotal, itemCount };
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
  getCartItemPricing: (item: CartItem) => ItemPricing;
  addCgBag: (bag: CgBagCartItem) => void;
  removeCgBag: (cartId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const cartPricing = React.useMemo(() => priceCartItems(state.items, state.globalWeightPricing), [state.items, state.globalWeightPricing]);
  const { user } = useAuth();
  const productIds = Array.from(new Set(state.items.map(item => item.product.id))).sort((a, b) => a - b);
  const allowanceUrl = `/api/discounts/item-allowances?productIds=${productIds.join(",")}`;
  const { data: currentPricingProducts } = useQuery<any[]>({
    queryKey: [allowanceUrl, user?.id ?? "anonymous"],
    queryFn: async () => {
      const response = await fetch(allowanceUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to verify item discounts");
      return response.json();
    },
    enabled: productIds.length > 0,
    refetchInterval: 15000,
    staleTime: 0,
  });
  useEffect(() => {
    if (!currentPricingProducts) return;
    const fresh = new Map(currentPricingProducts.map(product => [product.id, product]));
    const refreshed = state.items.map(item => ({
      ...item,
      product: fresh.has(item.product.id) ? { ...item.product, ...fresh.get(item.product.id) } : item.product,
    }));
    if (refreshed.some((item, index) => JSON.stringify(item.product) !== JSON.stringify(state.items[index].product))) {
      dispatch({ type: "LOAD_CART", payload: refreshed });
    }
  }, [currentPricingProducts]);

  // Sync global weight pricing setting from the server
  const { data: weightPricingData } = useQuery<{ key: string; value: string | null }>({
    queryKey: ['/api/settings/global_weight_pricing_enabled'],
    queryFn: () => fetch('/api/settings/global_weight_pricing_enabled').then(r => r.ok ? r.json() : { key: 'global_weight_pricing_enabled', value: 'false' }),
    staleTime: 30_000,
  });

  useEffect(() => {
    const enabled = weightPricingData?.value === 'true';
    dispatch({ type: 'SET_WEIGHT_PRICING', payload: enabled });
  }, [weightPricingData]);

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
    // Restore CG bag items from localStorage
    const savedCgBags = localStorage.getItem('cgBagCart');
    if (savedCgBags) {
      try {
        const cgBagItems: CgBagCartItem[] = JSON.parse(savedCgBags);
        dispatch({ type: 'LOAD_CG_BAGS', payload: cgBagItems });
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state.items));
  }, [state.items]);

  useEffect(() => {
    localStorage.setItem('cgBagCart', JSON.stringify(state.cgBagItems));
  }, [state.cgBagItems]);

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
    localStorage.removeItem('cgBagCart');
  };

  const addCgBag = (bag: CgBagCartItem) => {
    dispatch({ type: 'ADD_CG_BAG', payload: bag });
  };

  const removeCgBag = (cartId: string) => {
    dispatch({ type: 'REMOVE_CG_BAG', payload: { cartId } });
  };

  const getEffectivePrice = (productId: number, size?: string): number => {
    const matching = state.items.find(item => item.product.id === productId && item.size === size && !item.isFree && item.customPrice === undefined)
      ?? state.items.find(item => item.product.id === productId && item.size === size);
    return matching ? getCartItemPricing(matching).unitPrice : 0;
  };

  const getCartItemPricing = (item: CartItem): ItemPricing => {
    const index = state.items.indexOf(item);
    return cartPricing[index]
      ?? priceCartItems([item], state.globalWeightPricing)[0];
  };


  return (
    <CartContext.Provider value={{ state, addItem, addFreeItem, addDiscountedItem, removeItem, updateQuantity, clearCart, getEffectivePrice, getCartItemPricing, addCgBag, removeCgBag }}>
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
