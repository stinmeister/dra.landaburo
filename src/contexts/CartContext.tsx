'use client';
// CartContext — persiste el carrito en localStorage con la clave landaburo_cart_v1.
// El flag `hydrated` evita el mismatch de hidratación SSR/cliente: el estado inicial
// vacío es lo que renderiza el servidor, localStorage se lee recién en el primer effect.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import AddedToCartSheet, { type AddedCartNoticeData } from '@/components/tienda/AddedToCartSheet';

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price_ars: number;
  image_url: string | null;
  quantity: number;
  max_stock?: number;
}

export interface AddItemResult {
  addedQuantity: number;
  cappedByStock: boolean;
  currentQuantity: number;
  maxStock?: number;
}

interface CartContextType {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => AddItemResult;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  dismissAddedNotice: () => void;
  totalItems: number;
  totalARS: number;
}

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = 'landaburo_cart_v1';

function sanitizeStoredItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is CartItem => Boolean(entry && typeof entry.id === 'string'))
    .map((entry) => {
      const maxStock =
        typeof entry.max_stock === 'number' && Number.isFinite(entry.max_stock)
          ? Math.max(0, Math.floor(entry.max_stock))
          : undefined;
      const rawQty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      const quantity =
        typeof maxStock === 'number' && maxStock > 0 ? Math.min(rawQty, maxStock) : rawQty;
      return {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        price_ars: Number(entry.price_ars) || 0,
        image_url: entry.image_url ?? null,
        quantity,
        ...(typeof maxStock === 'number' ? { max_stock: maxStock } : {}),
      };
    });
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [addedNotice, setAddedNotice] = useState<AddedCartNoticeData | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Cierra el aviso automáticamente al navegar a otra ruta (ej. /tienda/carrito)
  useEffect(() => {
    setAddedNotice(null);
  }, [pathname]);

  // Lee localStorage solo en el cliente para evitar mismatch SSR/CSR
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = sanitizeStoredItems(JSON.parse(stored));
        itemsRef.current = parsed;
        setItems(parsed);
      }
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

  const addItem = useCallback(
    (newItem: Omit<CartItem, 'quantity'>, quantity: number = 1): AddItemResult => {
      const requestedQty = Math.max(1, Math.floor(quantity || 1));
      const prev = itemsRef.current;
      const existing = prev.find((i) => i.id === newItem.id);

      const effectiveMax =
        typeof newItem.max_stock === 'number' && Number.isFinite(newItem.max_stock)
          ? Math.max(0, Math.floor(newItem.max_stock))
          : existing?.max_stock;

      const currentQty = existing ? existing.quantity : 0;

      if (typeof effectiveMax === 'number' && effectiveMax === 0) {
        return {
          addedQuantity: 0,
          cappedByStock: true,
          currentQuantity: currentQty,
          maxStock: 0,
        };
      }

      const availableToAdd =
        typeof effectiveMax === 'number'
          ? Math.max(0, effectiveMax - currentQty)
          : requestedQty;
      const actualAdded = Math.min(requestedQty, availableToAdd);
      const cappedByStock = actualAdded < requestedQty;

      if (actualAdded <= 0) {
        // Si venía de una sesión vieja con cantidad mayor al stock actual o sin max_stock, normalizar
        if (
          existing &&
          typeof effectiveMax === 'number' &&
          (existing.quantity > effectiveMax || existing.max_stock !== effectiveMax)
        ) {
          const normalizedQty = Math.min(existing.quantity, effectiveMax);
          const next = prev.map((i) =>
            i.id === newItem.id
              ? { ...i, quantity: normalizedQty, max_stock: effectiveMax }
              : i
          );
          itemsRef.current = next;
          setItems(next);
          return {
            addedQuantity: 0,
            cappedByStock: true,
            currentQuantity: normalizedQty,
            maxStock: effectiveMax,
          };
        }

        return {
          addedQuantity: 0,
          cappedByStock: true,
          currentQuantity: currentQty,
          maxStock: effectiveMax,
        };
      }

      const nextQty = currentQty + actualAdded;
      const nextItems = existing
        ? prev.map((i) =>
            i.id === newItem.id
              ? {
                  ...i,
                  price_ars: newItem.price_ars,
                  image_url: newItem.image_url,
                  quantity: nextQty,
                  ...(typeof effectiveMax === 'number' ? { max_stock: effectiveMax } : {}),
                }
              : i
          )
        : [
            ...prev,
            {
              ...newItem,
              quantity: actualAdded,
              ...(typeof effectiveMax === 'number' ? { max_stock: effectiveMax } : {}),
            },
          ];

      itemsRef.current = nextItems;
      setItems(nextItems);

      setAddedNotice({
        id: newItem.id,
        slug: newItem.slug,
        name: newItem.name,
        price_ars: newItem.price_ars,
        image_url: newItem.image_url,
        addedQuantity: actualAdded,
        cappedByStock,
      });

      return {
        addedQuantity: actualAdded,
        cappedByStock,
        currentQuantity: nextQty,
        maxStock: effectiveMax,
      };
    },
    []
  );

  const dismissAddedNotice = useCallback(() => {
    setAddedNotice(null);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => {
      const next = prev.map((i) => {
        if (i.id !== id) return i;
        const clamped =
          typeof i.max_stock === 'number' && i.max_stock > 0
            ? Math.min(quantity, i.max_stock)
            : quantity;
        return { ...i, quantity: clamped };
      });
      itemsRef.current = next;
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
  }, []);

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
        items={items}
        totalItemsInCart={totalItems}
        totalARS={totalARS}
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
