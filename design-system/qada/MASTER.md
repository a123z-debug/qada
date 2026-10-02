# QADA Quiet Luxury — Design System

Source basis: UI/UX Pro Max design-system workflow, adapted for a Saudi legal AI platform.

## Product posture
- Category: Legal / AI / professional services.
- Primary experience: trust, clarity, authority, calm precision.
- Visual direction: Quiet Luxury + restrained editorial + enterprise legal-tech.
- Mobile-first and Arabic RTL by default.

## Core principles
1. Authority before decoration.
2. Gold is an accent, never the primary canvas.
3. Saudi green is the identity anchor.
4. Avoid neon, loud AI-purple/pink gradients, decorative glass overload, and excessive glow.
5. Every interactive element must have visible hover/focus/pressed states.
6. Dense legal information must remain legible and scannable.
7. Simple mode removes technical language; Professional and Admin may expose structure.
8. No functionality or legal logic should depend on color alone.

## Color tokens
- Ink 950: #08130F
- Ink 900: #102019
- Green 800: #064B32
- Green 700: #006C35
- Green 600: #0A7B47
- Gold 500: #C7A15A
- Gold 300: #E7CF9A
- Ivory 50: #FBFAF5
- Paper 100: #F4F1E8
- Surface: #FFFFFF
- Muted: #66736D
- Border: rgba(16, 32, 25, .10)
- Danger: #B42318
- Warning: #B7791F
- Success: #176B45

## Typography
Use local/system-safe Arabic stacks only; do not add remote font dependencies.
- UI: "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Segoe UI", Tahoma, Arial, sans-serif
- Legal/editorial: "Traditional Arabic", "Noto Naskh Arabic", Tahoma, serif
- Headings: strong weight with tighter tracking; avoid exaggerated display sizes on mobile.
- Body: line-height 1.75–1.9 for legal prose.

## Surfaces
- User: warm ivory canvas, white paper-like cards, subtle green tint.
- Professional: dark evergreen/ink hero with ivory content surfaces.
- Admin: technical dark mode retained, but reduce violet/cyan decoration to functional status only.
- Borders: thin and low-contrast.
- Shadows: broad, soft, low opacity; no neon bloom.

## Radius & spacing
- Small controls: 12–14px
- Cards: 18–24px
- Hero / primary shell: 28–32px
- Use 4/8/12/16/24/32 spacing rhythm.

## Motion
- 160–240ms for hover/focus transitions.
- Subtle translateY(-1px) on premium cards only.
- Respect prefers-reduced-motion.
- Never animate critical legal content or change semantic state through animation.

## Simple mode
- One dominant action.
- One clear question at a time.
- Avoid technical agent/gate terminology.
- User story input must feel like a premium consultation desk, not a chatbot toy.

## Professional mode
- Explicit structure and case tools.
- Court cards behave like premium workspace modules.
- Gold indicates priority/selection only.
- Dark hero + light content creates hierarchy without visual noise.

## Admin
- Sentinel, Agent Map, Audit, Analysis remain technical.
- Status colors preserve semantic meaning.
- Keep typography and spacing aligned with the rest of QADA.

## Accessibility / delivery checks
- 44px minimum touch targets on mobile.
- Visible :focus-visible states.
- Text contrast >= 4.5:1 where applicable.
- Layout checks: 375, 768, 1024, 1440.
- No clipped chips, long labels, identifiers, or Arabic headings.
- Icons from Lucide; no emoji-as-icon UI.
- prefers-reduced-motion respected.
