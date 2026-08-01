# أثواب (Athwab) — Women's Fashion Store

A bilingual (Arabic/English) e-commerce storefront for a local women's clothing store in Libya with multiple branches. Built with Next.js (App Router), Tailwind CSS, and Supabase.

## Features

- Bilingual site (Arabic default/RTL, English/LTR) with a language switcher
- Product catalog backed by Supabase — categories, filtering, search, sorting, and pagination, built to scale to many products
- Product detail pages with size/color selection and a shopping cart (stored in `localStorage`)
- Checkout via WhatsApp — orders are composed as a message and sent to the store or a chosen branch
- Multi-branch page with address, hours, phone, WhatsApp, and map links
- About and Contact pages

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL and anon/publishable key
npm run dev
```

## Data model

The Supabase project has three tables: `branches`, `categories`, and `products` (bilingual `_ar`/`_en` fields), with row-level security allowing public read access. See `src/lib/data.ts` for all queries and `src/types/index.ts` for the shape of each table.

To manage branches/categories/products, use the Supabase dashboard or SQL editor for the connected project.

## Tech stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Supabase (Postgres + REST API)
- lucide-react icons
