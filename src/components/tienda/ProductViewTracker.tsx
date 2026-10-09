'use client';

import { useEffect, useRef } from 'react';
import { trackViewContent } from '@/lib/tracking';

interface ProductViewTrackerProps {
  product: {
    id: string | number;
    slug?: string;
    name: string;
    price_ars: number | null;
    category?: string | null;
  };
}

export default function ProductViewTracker({ product }: ProductViewTrackerProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    trackViewContent({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price_ars: product.price_ars,
      category: product.category,
    });
  }, [product.id, product.slug, product.name, product.price_ars, product.category]);

  return null;
}
