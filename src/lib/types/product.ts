// Tipo canónico del producto — refleja la tabla `products` de Supabase.
// Usado tanto en Server Components (tienda/page.tsx, tienda/[slug]/page.tsx)
// como en Client Components (ProductCard, AddToCartButton).
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand_type: string | null;
  price_ars: number;
  compare_price_ars: number | null;
  image_url: string | null;
  images: string[] | null;
  category: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}
