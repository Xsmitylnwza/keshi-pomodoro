# Keshi Design System (Universal Theme)

This design system captures the "Keshi" aesthetic—a blend of lo-fi, brutalist, and scrapbook styles characterized by high contrast, grainy textures, and orchestrated motion.

## 1. Core Design Tokens

### Color Palette
Add these to your `tailwind.config.js`:

```javascript
colors: {
  'accent-red': '#b91c1c',       // Primary Action / Focus Mode
  'accent-green': '#34d399',     // Secondary Action / Break Mode
  'accent-burgundy': '#4a0404',  // Deep accent for gradients
  'paper-cream': '#f2efe9',      // Main Text / Paper elements
  'bg-dark': '#080808',          // Global Background (Void)
  'bg-forest': '#022c22',        // Alternative Background
}
```

### Typography
Requires imports from Google Fonts:
`@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Permanent+Marker&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`

```javascript
fontFamily: {
  'grotesk': ['"Space Grotesk"', 'sans-serif'], // UI Text, Labels
  'serif-custom': ['"Crimson Text"', 'serif'],   // Quotes, Elegant headers
  'marker': ['"Permanent Marker"', 'cursive'],   // Accents, "Handwritten" notes
}
```

## 2. Global Effects (CSS)

Copy these into your `index.css`:

### Grainy Noise Overlay
Creates the signature film-grain texture.
```css
.noise-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 50;
  opacity: 0.07;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}
```

### Torn Paper Clip-Paths
Utilities for jagged edges.
```css
.torn-paper-1 {
  clip-path: polygon(2% 2%, 98% 1%, 100% 98%, 85% 96%, 75% 99%, 60% 95%, 50% 98%, 35% 96%, 25% 99%, 10% 96%, 0% 99%);
}
.torn-text-bg {
  clip-path: polygon(0 5%, 100% 0, 95% 100%, 5% 95%);
}
```

## 3. UI Patterns & Components

### The "Ransom Note" Letter
Used for titles or emphatic text.
```css
.ransom-letter {
  display: inline-flex;
  align-items: center; justify-content: center;
  background-color: var(--paper-cream);
  color: #000;
  padding: 0.1em 0.3em;
  font-weight: 900;
  text-transform: uppercase;
  box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);
  transition: transform 0.2s;
}
.ransom-letter:hover {
  transform: scale(1.1) rotate(0deg) !important;
  background-color: var(--accent-red);
  color: white;
}
```

### Custom Cursor
A two-part cursor system: a leading dot and a trailing ring.
*   **Logic:** Use a `useEffect` to track mouse position.
*   **Style:** Main dot is `mix-blend-difference` to ensure visibility on all backgrounds. Trailer ring expands on hoverable elements.

## 4. Animation System (Framer Motion)

The "feel" is defined by custom easings.

```typescript
// animations.ts
export const easings = {
    smooth: [0.43, 0.13, 0.23, 0.96],
    bounce: [0.68, -0.55, 0.265, 1.55],
    elastic: [0.175, 0.885, 0.32, 1.275],
};

export const fadeUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easings.smooth } }
};
```

**Orchestration Strategy:**
Use a `staggerContainer` on parent elements and `staggerItem` on children to create a cascading entrance effect, rather than having everything appear at once.

## 5. Implementation Checklist for New Projects

1.  [ ] Install dependencies: `npm install framer-motion lucide-react classnames`
2.  [ ] Update `tailwind.config.js` with colors and fonts.
3.  [ ] Add `@import` fonts to `index.css`.
4.  [ ] Add global CSS (Scrollbars, Noise Overlay).
5.  [ ] Create `components/CustomCursor.tsx` and mount it in `App.tsx`.
6.  [ ] Copy `utils/animations.ts`.
