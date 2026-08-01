import { supabase } from "@/lib/supabase/client";
import type { Branch, Category, Product } from "@/types";

const PAGE_SIZE = 12;

export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(slug, name_ar, name_en)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getNewProducts(limit = 8): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(slug, name_ar, name_en)")
    .eq("is_active", true)
    .eq("is_new", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type ProductFilters = {
  category?: string;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
};

export async function getProducts(
  filters: ProductFilters = {}
): Promise<{ products: Product[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select("*, categories!inner(slug, name_ar, name_en)", { count: "exact" })
    .eq("is_active", true);

  if (filters.category) {
    query = query.eq("categories.slug", filters.category);
  }
  if (filters.q) {
    query = query.or(
      `name_ar.ilike.%${filters.q}%,name_en.ilike.%${filters.q}%`
    );
  }

  switch (filters.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const total = count ?? 0;
  return {
    products: data ?? [],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(slug, name_ar, name_en)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 4
): Promise<Product[]> {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(slug, name_ar, name_en)")
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
