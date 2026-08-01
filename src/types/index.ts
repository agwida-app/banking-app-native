export type Locale = "ar" | "en";

export type Branch = {
  id: string;
  name_ar: string;
  name_en: string;
  city_ar: string;
  city_en: string;
  address_ar: string;
  address_en: string;
  phone: string;
  whatsapp: string;
  hours_ar: string;
  hours_en: string;
  map_url: string | null;
  sort_order: number;
};

export type Category = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
};

export type Product = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  images: string[];
  sizes: string[];
  colors: string[];
  stock: number;
  is_featured: boolean;
  is_new: boolean;
  is_active: boolean;
  created_at: string;
  categories?: { slug: string; name_ar: string; name_en: string } | null;
};

export type CartItem = {
  productId: string;
  slug: string;
  name_ar: string;
  name_en: string;
  price: number;
  image: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
};
