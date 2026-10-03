# QADA 8K Quiet Luxury — Design System

## Source of truth

Primary design intelligence: `a123z-debug/ui-ux-pro-max-skill` (fork of `nextlevelbuilder/ui-ux-pro-max-skill`), Skill version `2.13.0`.

The design is synthesized from these UI/UX Pro Max product profiles:
- **Legal Services** → Accessible & Ethical + Minimalism & Swiss Style, Trust & Authority, case-management dashboard, credibility paramount.
- **Government/Public Service** → accessibility-first, minimal/direct, high contrast, trust paramount.
- **Luxury/Premium Brand** → premium restraint, black/ivory/gold discipline, whitespace, exclusive feel.

QADA combines those recommendations with Saudi judicial identity. The product must look authoritative before it looks decorative.

## Product posture

- Category: Saudi legal AI / judicial professional services.
- Primary experience: trust, clarity, authority, calm precision.
- Visual direction: **Quiet Luxury + Accessible Swiss Legal-Tech**.
- Arabic RTL and mobile-first by default.
- “8K” means maximum perceived fidelity and consistency, not oversized effects or raster-heavy decoration.

## Core principles

1. Authority before decoration.
2. Saudi judicial green anchors the brand.
3. Brass/gold is an accent and status material, never the primary canvas.
4. Ivory/paper surfaces are used for human-facing legal work; deep ink/evergreen for command-center and modal depth.
5. Avoid neon, loud AI-purple/pink gradients, decorative glass overload, and bloom/glow.
6. Every interactive element has visible hover/focus/pressed/disabled states.
7. Dense legal information remains legible and scannable.
8. Simple mode removes internal agent/gate terminology.
9. Color never carries legal/status meaning alone; pair it with text/icon/label.
10. One primary action per view.

## Semantic color tokens

- Ink 1000: `#050B09`
- Ink 950: `#08130F`
- Ink 900: `#102019`
- Judicial Green 800: `#064B32`
- Judicial Green 700: `#006C35`
- Judicial Green 600: `#0A7B47`
- Trust Navy 800: `#18334B`
- Brass 600: `#A9823F`
- Brass 500: `#C7A15A`
- Brass 300: `#E7CF9A`
- Ivory 50: `#FBFAF5`
- Ivory 100: `#F7F4EC`
- Paper 100: `#F1EEE5`
- Text: `#13261F`
- Muted: `#66736D`
- Danger: `#B42318`
- Warning: `#B7791F`
- Success: `#18764B`
- Info: `#286483`

## Typography

No remote font dependency is required for the production shell.

- UI Arabic stack: `"IBM Plex Sans Arabic", "Noto Kufi Arabic", "Segoe UI", Tahoma, Arial, sans-serif`
- Legal/editorial stack: `"Traditional Arabic", "Noto Naskh Arabic", Tahoma, serif`
- Body size on mobile: 16px minimum for editable text.
- Legal prose line-height: 1.75–1.95.
- Heading hierarchy: 700–900 weight, compact but readable.
- Long tokens/IDs must wrap without breaking normal prose.

## Elevation system

- Level 1: subtle cards / secondary tools.
- Level 2: consultation desk / workspace headers / sticky editor toolbar.
- Level 3: modals / command-center / critical surfaces.
- Never use random shadows per component.
- No neon glow.

## Radius & spacing

- Small controls: 12px.
- Inputs/chips: 12–16px.
- Cards: 18–24px.
- Hero / primary shell: 28–32px.
- Spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Touch targets on mobile: 44px minimum.

## Motion

Shared motion tokens:
- Fast: 140ms.
- Base: 210ms.
- Slow: 320ms.

Rules:
- Animate transform/opacity/color/elevation, not layout dimensions.
- Press feedback is immediate and does not shift surrounding layout.
- Critical legal content does not animate for decoration.
- Respect `prefers-reduced-motion`.
- No more than 1–2 attention animations per view.

## Surface language

### Public / Authentication
Warm premium judicial identity. High trust, strong contrast, low decorative noise.

### QADA Simple
A premium consultation desk:
- One dominant action.
- One question at a time.
- Paper/ivory surfaces.
- No internal pipeline language.
- User story area feels like a legal consultation form, not a toy chatbot.

### QADA Professional
A professional legal workspace:
- Strong hierarchy.
- Explicit tools and court context.
- Dark evergreen/ink hero with paper work surfaces.
- Gold indicates priority/selection only.

### Case Workspaces
Administrative, general, and criminal areas use one visual language. Jurisdiction changes content and semantics, not the entire visual brand.

### Legal Editor
Paper-first reading/writing surface, sticky high-quality toolbar, comfortable long-form line height, obvious review states.

### Modal System
Deep ink/evergreen private-chamber surface with restrained brass top edge. All modals share the same elevation, border, input, focus, and mobile sheet behavior.

### Admin
Technical dark mode with judicial material palette:
- Sentinel severity colors remain semantic.
- Violet/cyan decorative gradients are suppressed.
- Agent Map, Analysis, Audit, Users share one command-center language.

## Accessibility requirements

Derived directly from UI/UX Pro Max priority rules:
- Normal text contrast >= 4.5:1.
- Visible `:focus-visible`.
- Keyboard navigation must remain usable.
- Icon-only controls require accessible names.
- Decorative icons beside visible labels should be hidden from the accessibility tree.
- 44px touch targets on mobile.
- 8px+ spacing between primary touch targets where practical.
- No hover-only primary interaction.
- Loading and disabled states must be visually distinct.
- Error messages must explain recovery.
- Authentication must allow paste/password managers.
- Sticky headers must not obscure focus.
- Reduced motion supported.

## Performance requirements

- Prefer CSS/vector surfaces over raster decoration.
- No remote font dependency in the premium layer.
- No heavyweight visual library required for polish.
- Avoid layout-thrashing animation.
- Preserve current lazy-loaded feature boundaries.
- Keep visual effects compositing-friendly.

## Responsive checkpoints

Mandatory review widths:
- 375px
- 768px
- 1024px
- 1440px

Also review mobile landscape where fixed/sticky UI exists.

## Iconography

- Lucide is the structural icon system.
- No emoji as navigation, status, or button icons.
- Keep stroke style consistent within each hierarchy.
- Meaningful icon-only controls require `aria-label`.
- Status uses icon + text, not color alone.

## Anti-patterns

- AI-purple as the default brand language.
- Mixed neon cyan/violet/rose decoration.
- Excessive glassmorphism.
- Gold-filled entire pages.
- Tiny icon-only buttons.
- Placeholder-only fields.
- Random shadows/radii.
- Arbitrary per-court color themes.
- Emoji used as product UI icons.
- Giant marketing typography inside workspaces.
- Hidden overflow that clips Arabic labels or identifiers.

## Implementation

The final cascade layer is `src/qada-8k.css`, imported after `src/index.css` from `src/main.tsx`.

Component hooks use explicit `qada-8k-*` classes so the premium layer can be audited and regression-tested without modifying legal logic.
