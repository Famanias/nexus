# Context Compression Report

## Project Overview
**Nexus (`ojt-tracker`)** is an On-The-Job Training management platform designed to connect trainees, supervisors, and administrators. It features GPS-verified attendance clock-ins, time tracking, Kanban task management, automated email workflows via n8n/Resend, and dynamic analytics. 

- **Tech Stack**: Next.js 16.1.6 (App Router with Turbopack), React 19.2.3 (React Compiler enabled), TypeScript 5, Tailwind CSS v4, Emotion, Material UI v7 (`@mui/material`), `@supabase/ssr` / Supabase PostgreSQL, Upstash Redis rate-limiting, Vercel Analytics & Speed Insights.
- **Live Production URL**: [https://www.nexxus.lol](https://www.nexxus.lol)

---

## Current Architecture
- **Framework & Rendering**: Next.js 16 App Router. Pure Server Components (SSR/Static) for public landing pages (`/`), documentation (`/docs`), legal pages (`/privacy`, `/terms`), sitemap (`/sitemap.xml`), robots (`/robots.txt`), and manifest (`/manifest.webmanifest`). Client Components (`'use client'`) used for auth forms (`LoginForm`, `RegisterForm`), Kanban board (`@dnd-kit`), and dashboard management panels.
- **Middleware & Security (`src/proxy.ts`)**: Handles Supabase SSR authentication, role-based access control (`ojt`, `supervisor`, `admin`), prefetch request short-circuiting, and attaches per-request cryptographic nonces and Content Security Policy (CSP) headers via `src/lib/security/headers.ts`.
- **SEO & Metadata**: Dynamic `metadataBase` (`https://www.nexxus.lol`), OpenGraph, Twitter Cards, viewport theme colors, and JSON-LD `SoftwareApplication` structured data in `layout.tsx`.
- **Accessibility & UX**: `SkipToContent` link component, `:focus-visible` focus rings, high contrast text tokens ($> 7.0:1$ WCAG AA compliant), and `@media (prefers-reduced-motion: reduce)` animation pausing.

---

## Completed Work
1. **Google Lighthouse Optimization & Live Audit**:
   - **Accessibility**: **100 / 100** 💯 (Perfect Score)
   - **Best Practices**: **100 / 100** 💯 (Perfect Score)
   - **SEO**: **100 / 100** 💯 (Perfect Score)
   - **Performance**: **95 / 100** 🟢 (FCP `1.5s`, TBT `20ms`, CLS `0`, Speed Index `3.1s`)
2. **Proxy Middleware Fixes (`src/proxy.ts`)**: Exempted `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/manifest.json`, and `.webmanifest` static file extensions from Supabase auth middleware. This eliminated console syntax errors and invalid text crawler responses.
3. **SEO & PWA Assets**:
   - Created [sitemap.ts](file:///d:/repos/ojt-tracker/src/app/sitemap.ts), [robots.ts](file:///d:/repos/ojt-tracker/src/app/robots.ts), and [manifest.ts](file:///d:/repos/ojt-tracker/src/app/manifest.ts).
   - Updated root layout ([layout.tsx](file:///d:/repos/ojt-tracker/src/app/layout.tsx)) with OpenGraph, Twitter, viewport, and JSON-LD structured data.
4. **Accessibility Enhancements**:
   - Created [SkipToContent.tsx](file:///d:/repos/ojt-tracker/src/components/shared/SkipToContent.tsx) and attached `id="main-content"` in [page.tsx](file:///d:/repos/ojt-tracker/src/app/page.tsx).
   - Fixed document heading outline from `h4` to `h3` (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`).
   - Added `aria-hidden="true"` to all decorative inline SVGs.
   - Updated `:focus-visible` ring styles in [globals.css](file:///d:/repos/ojt-tracker/src/app/globals.css) and elevated secondary text contrast ratios in [landing.css](file:///d:/repos/ojt-tracker/src/app/landing.css).
5. **Quality Assurance**: 100% clean production builds (`npm run build`), 0 ESLint errors (`npm run lint`), and 45/45 passing unit/integration tests (`npm run test`).

---

## Current Focus
Concluding the initial phase of the Google Lighthouse Performance & Quality Improvement initiative. All optimizations have been deployed live and verified against [https://www.nexxus.lol](https://www.nexxus.lol).

---

## Key Technical Decisions
- **Measure Before Optimize**: Never optimize based on assumptions. Always run Lighthouse CLI audits (`npx lighthouse`) against production builds or live production URLs to measure baseline vs post-implementation deltas.
- **Proxy Exclusions for Static Metadata**: Static metadata generators (`robots.txt`, `sitemap.xml`, `manifest.webmanifest`) must be explicitly excluded in `src/proxy.ts` matcher and `publicRoutes` so Supabase auth middleware does not intercept them with HTML document response headers.
- **Canonical Origin Resolution**: `metadataBase`, `robots.ts`, and `sitemap.ts` fall back to `https://www.nexxus.lol` to avoid HTTP 301/302 redirect latency during audits.
- **Server Components First**: Public landing and documentation routes remain pure Server Components to minimize hydration overhead and JavaScript bundle size.

---

## Constraints
- **Security**: Must maintain strict per-request nonce generation and CSP headers for HTML document requests.
- **Design Integrity**: Dark minimal theme (`#000000`) must be maintained while guaranteeing text contrast ratios $> 4.5:1$ (WCAG AA).
- **Environment**: Performance testing must only be conducted against production builds (`npm run build && npm run start`) or the live deployment (`https://www.nexxus.lol`), never `npm run dev`.

---

## Known Issues
- None active in application functionality. `src/__tests__/unit/security.test.ts` has 1 minor ESLint warning regarding an unused mock variable (0 errors).

---

## Performance & Optimization
- **Live Scores ([https://www.nexxus.lol](https://www.nexxus.lol))**:
  - Accessibility: **100**
  - Best Practices: **100**
  - SEO: **100**
  - Performance: **95**
- **Core Web Vitals**:
  - **FCP**: `1.5s`
  - **LCP**: `2.7s`
  - **TBT**: `20ms`
  - **CLS**: `0`
  - **Speed Index**: `3.1s`

---

## Pending Tasks
- [ ] Investigate LCP candidate hero text/font preloading to push Performance score from 95 to 98–100.
- [ ] Run `@next/bundle-analyzer` to analyze client component chunk sizes (`@dnd-kit`, `@mui/material`).
- [ ] Evaluate `next/dynamic` for lazy-loading Cloudflare Turnstile (`@marsidev/react-turnstile`) in auth forms.

---

## Future Improvements
- WebP/AVIF format conversions for static images with Next.js `<Image />` priority loading.
- Modular import optimizations in `next.config.ts` for `@mui/icons-material`.
- PWA service worker offline caching capabilities.

---

## Important Files
- [src/proxy.ts](file:///d:/repos/ojt-tracker/src/proxy.ts): Auth middleware, role routing, CSP security headers, and static asset matcher exemptions.
- [src/app/layout.tsx](file:///d:/repos/ojt-tracker/src/app/layout.tsx): Root layout with metadataBase, OpenGraph, Twitter, viewport, JSON-LD, fonts, and SkipToContent.
- [src/app/page.tsx](file:///d:/repos/ojt-tracker/src/app/page.tsx): Main landing page with accessible heading structure, `#main-content` anchor, and `aria-hidden` SVGs.
- [src/app/sitemap.ts](file:///d:/repos/ojt-tracker/src/app/sitemap.ts): Dynamic XML sitemap generator.
- [src/app/robots.ts](file:///d:/repos/ojt-tracker/src/app/robots.ts): Dynamic `robots.txt` generator.
- [src/app/manifest.ts](file:///d:/repos/ojt-tracker/src/app/manifest.ts): Web App Manifest (`manifest.webmanifest`) generator.
- [src/components/shared/SkipToContent.tsx](file:///d:/repos/ojt-tracker/src/components/shared/SkipToContent.tsx): Accessibility skip link component.
- [src/app/globals.css](file:///d:/repos/ojt-tracker/src/app/globals.css) & [landing.css](file:///d:/repos/ojt-tracker/src/app/landing.css): Global styles, `:focus-visible` outline rings, and WCAG AA contrast variables.

---

## Useful Commands
- `npm run build`: Build production bundle using Next.js and Turbopack.
- `npm run start -- -p 3000`: Serve production build locally.
- `npm run lint`: Run ESLint static analysis.
- `npm run test`: Run Vitest unit & integration test suite.
- `npx lighthouse https://www.nexxus.lol --chrome-flags="--headless"`: Audit live production URL.

---

## AI Instructions
- Always follow Planning Mode: create/update `implementation_plan.md` and wait for user approval before making source code edits.
- Always audit performance on production builds (`npm run build && npm run start` or live HTTPS deployment), never on `npm run dev`.
- Maintain static file exemptions (`robots.txt`, `sitemap.xml`, `manifest.webmanifest`) in `src/proxy.ts`.
- Ensure dark theme visual design retains text contrast ratio $> 4.5:1$.

---

## End of Report
