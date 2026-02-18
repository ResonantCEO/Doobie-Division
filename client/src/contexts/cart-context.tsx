
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Product, Category } from "@shared/schema";

interface CartItem {
  product: Product & { category: Category | null };
  quantity: number;
  size?: string; // Optional size for products with sizes
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { product: Product & { category: Category | null }; size?: string } }
  | { type: 'REMOVE_ITEM'; payload: { id: number; size?: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number; size?: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
};

// Helper function to calculate item price based on selling method
function getItemPrice(product: Product & { category: Category | null }): number {
  if (product.sellingMethod === "weight") {
    // For weight-based products, use pricePerGram as the base unit price
    return Number(product.pricePerGram) || 0;
  } else {
    // For unit-based products, use the regular price
    return Number(product.price) || 0;
  }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      // For items with sizes, treat each size as a separate cart item
      const itemKey = action.payload.size 
        ? `${action.payload.product.id}-${action.payload.size}`
        : `${action.payload.product.id}`;
      
      const existingItem = state.items.find(item => {
        const key = item.size ? `${item.product.id}-${item.size}` : `${item.product.id}`;
        return key === itemKey;
      });
      
      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item => {
          const key = item.size ? `${item.product.id}-${item.size}` : `${item.product.id}`;
          return key === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      } else {
        newItems = [...state.items, { 
          product: action.payload.product, 
          quantity: 1,
          size: action.payload.size 
        }];
      }
      
      const total = newItems.reduce((sum, item) => sum + (getItemPrice(item.product) * item.quantity), 0);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return { items: newItems, total, itemCount };
    }
    
    case 'REMOVE_ITEM': {
      const itemKey = action.payload.size 
        ? `${action.payload.id}-${action.payload.size}`
        : `${action.payload.id}`;
      
      const newItems = state.items.filter(item => {
        const key = item.size ? `${item.product.id}-${item.size}` : `${item.product.id}`;
        return key !== itemKey;
      });
      const total = newItems.reduce((sum, item) => sum + (getItemPrice(item.product) * item.quantity), 0);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return { items: newItems, total, itemCount };
    }
    
    case 'UPDATE_QUANTITY': {
      const itemKey = action.payload.size 
        ? `${action.payload.id}-${action.payload.size}`
        : `${action.payload.id}`;
      
      const newItems = state.items.map(item => {
        const key = item.size ? `${item.product.id}-${item.size}` : `${item.product.id}`;
        return key === itemKey
          ? { ...item, quantity: Math.max(0, action.payload.quantity) }
          : item;
      }).filter(item => item.quantity > 0);
      
      const total = newItems.reduce((sum, item) => sum + (getItemPrice(item.product) * item.quantity), 0);
      const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      
      return { items: newItems, total, itemCount };
    }
    
    case 'CLEAR_CART':
      return initialState;
    
    case 'LOAD_CART': {
      const total = action.payload.reduce((sum, item) => sum + (getItemPrice(item.product) * item.quantity), 0);
      const itemCount = action.payload.reduce((sum, item) => sum + item.quantity, 0);
      
      return { items: action.payload, total, itemCount };
    }
    
    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  addItem: (product: Product & { category: Category | null }, size?: string) => void;
  removeItem: (productId: number, size?: string) => void;
  updateQuantity: (productId: number, quantity: number, size?: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount and validate against current stock
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

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product & { category: Category | null }, size?: string) => {
    dispatch({ type: 'ADD_ITEM', payload: { product, size } });
  };

  const removeItem = (productId: number, size?: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id: productId, size } });
  };

  const updateQuantity = (productId: number, quantity: number, size?: string) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: productId, quantity, size } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  return (
    <CartContext.Provider value={{ state, addItem, removeItem, updateQuantity, clearCart }}>
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
