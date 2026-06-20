# Task: Mapping and Recreating Pusat Valas Indo Website

- **Date**: 2026-04-19
- **Status**: In Progress
- **Source**: User request for website recreation and content mapping.

## 🎯 Goal

Thoroughly map the contents of `https://pusatvalasindo.com/`, document all assets and copy in `docs/contents/`, and create a phased plan for recreation using a premium Next.js architecture.

## 📋 Implementation Checklist

### Phase 1: Research & Discovery
- [x] **Step 1.1: Website Structure Mapping**
  - [x] Initialize "Gemini Flash Little Model" persona.
  - [x] Use `browser_subagent` to crawl `https://pusatvalasindo.com/`.
  - [x] Identify all primary navigation links and sub-pages.
  - [x] Document the global site map.
- [x] **Step 1.2: Design & Aesthetic Analysis**
  - [x] Extract color palette (Primary: #C62828 Red, White).
  - [x] Identify typography (Inter/Outfit for modern look).
  - [x] Analyze UI components (Created design-tokens.json).
  - [x] Capture the "premium" feel (Mapped shadow and spacing scales).

### Phase 2: Content Extraction & Documentation
- [x] **Step 2.1: Homepage Extraction**
  - [x] Extract hero section text and CTA.
  - [x] Extract features/services section.
  - [x] Map all exchange rate components.
- [x] **Step 2.2: Internal Page Extraction**
  - [x] Map "About Us" content.
  - [x] Map "Services" content.
  - [x] Map "Contact" and "Locations" data.
- [x] **Step 2.3: Global Elements**
  - [x] Extract Header/Navigation structure.
  - [x] Extract Footer content and links.
  - [x] Document SEO metadata (titles, descriptions).

### Phase 3: Recreation Planning (Next.js)
- [x] **Step 3.1: Technical Architecture**
  - [x] Define project structure updates (Drafted technical-spec.md).
  - [x] Plan for localization (Recommended next-intl).
  - [x] Plan for dynamic rate integration (Linked to backend stock module).
- [x] **Step 3.2: Component Blueprinting**
  - [x] Create a list of visual components to be built.
  - [x] Align with `web_application_development` guidelines for "Premium Designs".

## 🛠️ Technical Details

- **Files affected**: 
  - `docs/contents/*.md`
  - `docs/tasks/2026-04-19-content-mapping-and-recreation.md`
- **Dependencies**: 
  - Next.js (current framework)
  - Vanilla CSS / Modern UI Patterns

## 📝 Notes & Discoveries

- Initial goal is 100% content fidelity before implementation.
- Focus on "wow" factor for the recreation phase.
- Ensure all Indonesian/English text pair is captured.
- Site uses WordPress/PHP-based backend (`index.php` in URLs).
- Main color: Red (#C62828).
- Heavily relies on WhatsApp for customer interaction.
