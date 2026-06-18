// Deprecated: internal borders are now drawn by each component's own
// contained frame layer in styles/handdrawn.css. A shared app-wide SVG layer
// can cross scroll boundaries and cause border bleed-through.
export function HandDrawnInteriorBorders() {
  return null
}
