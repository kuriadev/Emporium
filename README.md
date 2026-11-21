# Emporium

A production-style e-commerce web app built from the Emporium Figma file: a dark, editorial storefront plus a role-based admin back office. Next.js (App Router) with strict TypeScript, Tailwind v4 rem tokens, Radix/shadcn-style primitives, Framer Motion, anime.js, dotLottie, React Hook Form + Zod, Zustand and SQLite via Drizzle.

## Quick start

Requires Node.js 20.9 or newer.

```bash
npm install
npm run setup      # writes .env.local with a random SESSION_SECRET and seeds the database
npm run dev        # http://localhost:3000
```

The SQLite database lives in `data/emporium.db` and creates and seeds itself on first request if you skip `setup`. Reset to fresh demo data with `npm run db:reset` (restart the dev server afterwards).

Production:

```bash
npm run build
SESSION_SECRET="$(openssl rand -base64 48)" EMPORIUM_SANDBOX=0 npm start
```

## Test accounts

The login pages show one-tap quick-fill buttons for these while `EMPORIUM_SANDBOX` is not `0`. They work the same on mobile and desktop.

| Where | Role | Email | Password |
| --- | --- | --- | --- |
| `/login` | Customer with order history | `alex.rivera@example.com` | `Customer#2026` |
| `/login` | Customer | `maria.santos@example.com` | `Customer#2026` |
| `/admin/login` | Super Admin (everything) | `admin@emporium.test` | `Admin#Emporium2026` |
| `/admin/login` | Catalog Manager (products, promotions) | `catalog@emporium.test` | `Catalog#Emporium2026` |
| `/admin/login` | Fulfillment Support (orders, customers, notes) | `support@emporium.test` | `Support#Emporium2026` |

Checkout sandbox: card `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined (any future expiry, any CVC). Promo codes: `WELCOME10`, `SAVE100`, `FREESHIP` (stacks with one other code), `HOLIDAY15` (₱5,000+), `SUMMER25` (expired, to show the error state).

Staff sign-in is rate limited to 3 attempts per account per 15 minutes, so repeated wrong passwords lock the form briefly.

## What to try

**Storefront** (`/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/account`, `/orders/[id]`): Ctrl/⌘+K search with typo tolerance and zero-result recovery, filters and sorting, quick view, compare, wishlist (merges into your account on sign-in), recently viewed, volume pricing, bundles, back-in-stock alerts, reviews with a rating histogram, Intl currency display, delivery ETA, gift wrap, stacked promo codes, idempotent checkout with atomic stock reservation, order tracking, cancellation and returns. On phones there is a sticky bottom dock and sticky add-to-bag and checkout bars; the header hides while you scroll down.

**Admin** (`/admin`): KPI dashboard with period comparisons and a revenue chart, fulfilment queue, Needs Restock list, zero-result searches and abandoned carts; products with a variant matrix generator, bulk actions, CSV import/export, sanitised Markdown preview and validated image uploads; orders that follow Pending → Paid → Packed → Shipped → Delivered (plus Cancelled and Refunded) with tracking numbers, partial or full refunds with reasons and printable packing slips; a customer CRM with lifetime value, notes and suspension; a promotions manager with presets, scheduling and usage caps; and an append-only audit log with field-level diffs. Tables turn into cards on mobile, and the admin has its own Ctrl/⌘+K palette.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run setup` | Create `.env.local` and seed the database |
| `npm run db:reset` | Wipe and reseed demo data |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Vitest unit tests (pricing, state machine, validation, security helpers) |
| `npm run test:e2e` | Playwright tests on desktop and mobile viewports (run `npx playwright install chromium` once) |

## Project structure

```
src/
  app/                 routes: (store) storefront, (auth) login/register, admin/(auth) + admin/(panel), api/
  components/          ui primitives, layout, store, admin, auth, account, feedback (error/404)
  lib/                 pricing, money, order state machine, search, promo rules
  lib/validations/     Zod schemas shared by client forms and the server
  lib/security/        sanitising, safe redirects, CSV, rate limiter, CSRF helpers
  server/              auth (sessions, guards, permissions), actions, services, security, db (schema + seed)
  proxy.ts             CSP nonce, admin gate, CSRF cookie
tests/unit, tests/e2e  Vitest and Playwright
```

## Security notes

- Passwords hashed with scrypt; sessions are opaque IDs in `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookies, never `localStorage`. Suspending an account or changing a password revokes every session.
- Roles (`customer` / `admin`, plus Super Admin, Catalog Manager, Fulfillment Support) are checked in the proxy **and** again in every page, server action and route handler. Order pages verify ownership.
- Every input is validated with the same Zod schemas on client and server and sanitised server-side. Markdown is escaped first and rendered from an allow-list. CSV exports neutralise formula injection.
- Mutations require same-origin `Origin`/`Referer`; route handlers also require a double-submit CSRF token.
- Sign-in, registration, checkout, promo guessing and public forms are rate limited. Errors never expose stack traces; logs redact passwords, tokens, emails and phone numbers.
- CSP with per-request nonces, HSTS, `frame-ancestors 'none'`, `nosniff` and a strict referrer policy.
- Uploads are checked by magic bytes, declared MIME type, size (5 MB) and dimensions, then stored under random names.

## A note on the requested libraries

The sandbox this was built in could not reach kokonutui.com, shadcnblocks.com or lottie.host, so the hero blocks, Kokonut-style components and Lottie animations were rebuilt in-house to match the Figma design (anime.js, Framer Motion and the dotLottie player are real dependencies). Swapping in the originals later only touches the component files in `src/components`.
