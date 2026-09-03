---
name: PERKOM Enterprise Dashboard
description: Compact enterprise operations UI for the PERKOM expense approval system; light, structured, dense.
colors:
  primary: "#2B5CE6"          # PERKOM brand blue (oklch 0.546 0.245 262.881)
  primary-content: "#FFFFFF"
  secondary: "#0F2A5E"        # dark navy for headings/emphasis
  secondary-content: "#FFFFFF"
  accent: "#2B5CE6"
  accent-content: "#FFFFFF"
  neutral: "#3F4550"
  neutral-content: "#FFFFFF"
  surface: "#F6F7F9"          # app canvas (daisyUI base-200)
  surface-card: "#FFFFFF"     # cards, sidebar, navbar (daisyUI base-100)
  on-surface: "#1C2733"       # dark navy/black text (daisyUI base-content)
  on-surface-muted: "#66707D"
  border: "#E3E6EA"
  success: "#178A50"
  warning: "#B4730E"
  error: "#C13B3B"
  info: "#2E7DD1"
typography:
  page-title: { fontFamily: var(--font-sans), fontSize: 24px, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.01em }
  section-title: { fontFamily: var(--font-sans), fontSize: 16px, fontWeight: 600, lineHeight: 1.4 }
  body-md: { fontFamily: var(--font-sans), fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: var(--font-sans), fontSize: 13px, fontWeight: 400, lineHeight: 1.5 }
  label-nav: { fontFamily: var(--font-sans), fontSize: 14px, fontWeight: 500, lineHeight: 1 }
  label-section: { fontFamily: var(--font-sans), fontSize: 11px, fontWeight: 600, lineHeight: 1, letterSpacing: 0.06em }
  stat-value: { fontFamily: var(--font-sans), fontSize: 24px, fontWeight: 700, lineHeight: 1.1 }
  stat-label: { fontFamily: var(--font-sans), fontSize: 12px, fontWeight: 400, lineHeight: 1.2 }
rounded:
  sm: 4px     # selectors (daisyUI --radius-selector)
  md: 6px     # fields, buttons (daisyUI --radius-field)
  lg: 8px     # cards, boxes (daisyUI --radius-box)
spacing:
  page: 24px  # desktop page padding (lg: 32px)
  card: 16px  # card padding (xl cards: 24px)
  nav-item: 40px
  navbar: 64px
  sidebar: 256px
components:
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  kpi-card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
    typography: "{typography.stat-value}"
  nav-item-active:
    backgroundColor: "rgba(43, 92, 230, 0.08)"
    textColor: "{colors.primary}"
    typography: "{typography.label-nav}"
  sidebar:
    backgroundColor: "{colors.surface-card}"
    width: "{spacing.sidebar}"
---

# PERKOM Enterprise Dashboard

## Overview
Internal back-office tool for approving employee transport (Grab/Gojek) claims and
managed-service requests. Users are operations/HR staff who scan tables and act on
pending items all day. The UI must feel like a mature business platform: structured,
compact, quiet. Layout language is inspired by Grab for Business (sidebar hierarchy,
top navbar, KPI row, dense widgets) but all branding is PERKOM's own.

## Colors
- **Primary (#2B5CE6):** the only saturated color. Active navigation, primary
  buttons, links, selected states, chart marks. Never for large surfaces.
- **Secondary (#0F2A5E):** dark navy, reserved for rare emphasis. Stat values,
  headings, and user-facing numbers are black (on-surface), never navy or grey.
- **Neutrals:** app canvas #F6F7F9, cards/sidebar/navbar white, borders #E3E6EA,
  body text #1C2733, muted text #66707D. One cool-gray family only.
- **Status colors are reserved:** success/warning/error/info appear only on status
  badges and state indicators, never as decoration.
- White cards sit on the gray canvas; borders separate, shadows are not used
  (flat enterprise look, daisyUI `--depth: 0`).

## Typography
- Existing project sans (Geist). Hierarchy by weight and color, not scale.
- Page title 24px/600; section titles 16px/600; body 14px; nav 14px/500;
  secondary text 12-13px. Sidebar section labels 11px uppercase with wide tracking
  (used sparingly: TRIPS, MANAGE SERVICE only).
- Numbers in KPI cards 24px/700 navy; supporting labels 12px muted.

## Layout
- Persistent sidebar 256px (collapses to icons), navbar 64px spanning the content
  area, main content 24px padding (32px on large screens).
- Dashboard: page header, one row of 5 compact KPI cards, then 2-column widget grid
  (chart 2/3 + status summary 1/3), then recent claims table.
- Tablet: widgets stack to one column, sidebar collapses. Mobile: daisyUI drawer,
  single column, tables scroll horizontally.

## Elevation & Depth
- Flat: 1px borders on white cards over the gray canvas. No glassmorphism, no
  gradients, no floating cards, no shadows except focus rings.

## Shapes
- One radius system: 4px selectors / 6px fields & buttons / 8px cards
  (daisyUI radius tokens). No pills except status badges.

## Components
- daisyUI 5 supplies the visual system: `menu`, `drawer`, `navbar`, `dropdown`,
  `table table-sm`, `badge badge-soft`, `stat` parts, `btn`, `input`, `tooltip`.
- Cards: white, 1px border, 8px radius, 16-24px padding. Not every section is a
  card; group with spacing where possible.
- Active nav item: light blue tint background, blue icon + text, weight 500.
- KPI card: label (12px muted) top, 24px/700 navy value, small real supporting
  line. No decorative icons-in-colored-squares; a small muted icon top-right only.

## Do's and Don'ts
- Do use only real application data; no fabricated metrics, notifications, or charts.
- Do keep blue selective: one primary-colored element per view area.
- Don't use gradients, glassmorphism, decorative blobs, illustrations, or oversized
  rounded cards.
- Don't use oversized typography or huge empty spaces; match enterprise density.
- Don't copy Grab assets, colors, or logos; structure only.
- Text wears text tokens (navy/muted), never the series color.
