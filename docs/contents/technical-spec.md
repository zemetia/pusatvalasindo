# Technical Specification: Pusat Valas Indo Recreation

## 🏙️ Architecture Overview
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4 + Shadcn UI (Customized with Design Tokens)
- **Animations**: Framer Motion for smooth transitions and scroll-triggered animations.
- **Icons**: Lucide React + Tabler Icons.
- **Language**: Bilingual (Indonesian / English) using sub-path routing or a custom hook.

## 📂 Project Structure Proposals
```text
app/
  [locale]/              # For i18n support
    layout.tsx           # Shared bilingual layout
    page.tsx             # New Premium Homepage
    about/page.tsx       # About Us
    services/page.tsx    # Services Detail
    contact/page.tsx     # Contact & Locations
    testimonials/page.tsx # Full Testimonials
components/
  premium/               # Custom high-end UI components
    Hero.tsx
    InteractiveMap.tsx
    ExchangeRateList.tsx
    TrustBadges.tsx
```

## 🌍 Internationalization (i18n)
- **Plan**: Implement `next-intl` to handle `/id` and `/en` routes.
- **Why**: Essential for a professional money changer in Jakarta to cater to both tourists and locals.

## 📈 Dynamic Exchange Rates
- **Plan**: 
  - Create a mock data service initially.
  - Eventually link to the **Currency Stock** module in the `backend`.
  - Display "Last Updated" timestamp for credibility.

## 🎨 Creative Vision
- **Theme**: "Glassmorphism" for navigation and cards.
- **Micro-interactions**: Subtle scale-up on card hover, smooth fade-in for sections.
- **Mobile First**: Extreme focus on mobile usability as most users check rates on-the-go.

## 🛠️ Component Blueprint
1. **NavHeader**: Glassmorphism effect, sticky with red accent line on scroll.
2. **HeroSection**: High-quality imagery (Jakarta Skyline) with a centralized Rate Calculator.
3. **LiveRatesWidget**: Auto-refreshing grid of core currencies (USD, SGD, MYR, EUR).
4. **BranchLocator**: Card-based branch info with one-click WhatsApp and Directions.
5. **TestimonialCarousel**: Premium card layout with star ratings and verified badges.
6. **Footer**: Clean, deep-gray footer with quick links and legal info.
