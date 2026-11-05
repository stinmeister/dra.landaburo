'use client';
// CartContext — persiste el carrito en localStorage con la clave landaburo_cart_v1.
// El flag `hydrated` evita el mismatch de hidratación SSR/cliente: el estado inicial
// vacío es lo que renderiza el servidor, localStorage se lee recién en el primer effect.
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import AddedToCartSheet, { type AddedCartNoticeData } from '@/components/tienda/AddedToCartSheet';

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  dismissAddedNotice: () => void;
  totalItems: number;
  totalARS: number;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = 'landaburo_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [addedNotice, setAddedNotice] = useState<AddedCartNoticeData | null>(null);

  // Cierra el aviso automáticamente al navegar a otra ruta (ej. /tienda/carrito)
  useEffect(() => {
    setAddedNotice(null);
  }, [pathname]);

  // Lee localStorage solo en el cliente para evitar mismatch SSR/CSR
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      // localStorage bloqueado (ej. modo incógnito con cookies deshabilitadas)
    }
    setHydrated(true);
  }, []);

  // Persiste cambios al carrito después de hidratación
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Falla silenciosa si localStorage no está disponible
    }
  }, [items, hydrated]);

  const addItem = useCallback((newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    setItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...newItem, quantity: qty }];
    });
    setAddedNotice({
      id: newItem.id,
      slug: newItem.slug,
      name: newItem.name,
      price_ars: newItem.price_ars,
      image_url: newItem.image_url,
      addedQuantity: qty,
    });
  }, []);

  const dismissAddedNotice = useCallback(() => {
    setAddedNotice(null);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalARS = items.reduce((sum, i) => sum + i.price_ars * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        dismissAddedNotice,
        totalItems,
        totalARS,
      }}
    >
      {children}
      <AddedToCartSheet
        notice={addedNotice}
        totalItemsInCart={totalItems}
        onDismiss={dismissAddedNotice}
      />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
