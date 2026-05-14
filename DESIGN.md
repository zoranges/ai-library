# DESIGN.md

## Color Strategy

**Restrained with committed moments.** The base is tinted neutrals; a single saturated accent carries key interactions. Achievement/reward moments get a second color (amber) for emotional punch. Data visualization uses a full palette deliberately.

### Palette (OKLCH notation)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `oklch(0.99 0.005 250)` | Page background — barely blue-tinted white |
| `--color-surface` | `oklch(1.0 0.003 250)` | Card/panel surfaces |
| `--color-surface-raised` | `oklch(0.97 0.006 250)` | Elevated surfaces (dropdowns, popovers) |
| `--color-border` | `oklch(0.88 0.01 250)` | Subtle borders |
| `--color-border-strong` | `oklch(0.75 0.015 250)` | Emphasized borders |
| `--color-text` | `oklch(0.15 0.02 250)` | Primary text — deep slate, not pure black |
| `--color-text-secondary` | `oklch(0.45 0.015 250)` | Secondary text |
| `--color-text-tertiary` | `oklch(0.65 0.01 250)` | Placeholder, hint text |
| `--color-accent` | `oklch(0.55 0.2 255)` | Primary interactive — deep blue |
| `--color-accent-hover` | `oklch(0.50 0.22 255)` | Hover state |
| `--color-accent-subtle` | `oklch(0.95 0.03 255)` | Accent tint backgrounds |
| `--color-success` | `oklch(0.65 0.18 155)` | Achievement, completion |
| `--color-warning` | `oklch(0.75 0.16 85)` | Points, rewards, streaks |
| `--color-error` | `oklch(0.60 0.2 25)` | Errors, destructive actions |

### Dark mode (admin dashboard)

| Token | Value |
|-------|-------|
| `--color-bg` | `oklch(0.14 0.015 255)` |
| `--color-surface` | `oklch(0.18 0.015 255)` |
| `--color-surface-raised` | `oklch(0.22 0.02 255)` |
| `--color-border` | `oklch(0.28 0.015 255)` |
| `--color-text` | `oklch(0.93 0.005 255)` |
| `--color-text-secondary` | `oklch(0.65 0.01 255)` |

## Typography

| Role | Font | Weight | Size (desktop) |
|------|------|--------|----------------|
| Display | `Plus Jakarta Sans` | 700 | 36px |
| H1 | `Plus Jakarta Sans` | 700 | 28px |
| H2 | `Plus Jakarta Sans` | 600 | 22px |
| H3 | `Plus Jakarta Sans` | 600 | 18px |
| Body | `Noto Sans SC` / system | 400 | 15px |
| Body small | `Noto Sans SC` / system | 400 | 13px |
| Caption | `Noto Sans SC` / system | 500 | 12px |
| Mono/data | `JetBrains Mono` | 500 | 14px |

Line length cap: 70ch. Body line-height: 1.6. Heading line-height: 1.2.

## Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| 0 | none | Flat surfaces, page bg |
| 1 | `0 1px 2px oklch(0.0 0 0 / 0.06)` | Cards at rest |
| 2 | `0 4px 12px oklch(0.0 0 0 / 0.08)` | Cards on hover, dropdowns |
| 3 | `0 8px 24px oklch(0.0 0 0 / 0.12)` | Modals, popovers |

## Spacing

Base unit: 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Badges, small elements |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-xl` | 16px | Modals, large containers |
| `--radius-full` | 9999px | Avatars, pills |

## Motion

| Transition | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Micro | 120ms | ease-out-quart | Hover, focus, toggle |
| Standard | 200ms | ease-out-quart | Panel slide, fade |
| Emphasized | 350ms | ease-out-quint | Page transition, modal |
| Exit | 150ms | ease-in-quad | Dismiss, close |

## Component Patterns

- **Buttons**: Solid fill for primary, subtle bg for secondary, ghost for tertiary. No borders on primary. 8px radius. 36px height (md). Icon + label gap: 8px.
- **Inputs**: 40px height. Subtle border, accent on focus. Label above, hint/error below. No floating labels.
- **Cards**: 12px radius, 1px border, level-1 shadow. No colored left borders. No gradient overlays.
- **Tables**: Minimal — no zebra striping, subtle row hover bg, 1px bottom borders only.
- **Modals**: 16px radius, centered, backdrop blur 4px. Slide-up entrance.
- **Tabs**: Underline style for primary navigation, pill style for inline toggles.
- **Toasts**: Bottom-right, 8px radius, icon + message + dismiss. Auto-dismiss 4s.

## Iconography

Lucide icons, 1.5px stroke. Size: 16px inline, 20px standalone, 24px feature. No filled variants.
