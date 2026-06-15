// Flat oval track geometry — top-down view

export interface TrackGeometry {
  cx: number;
  cy: number;
  rx: number;   // outer x radius
  ry: number;   // outer y radius
  width: number; // track band width
}

export function getTrackGeometry(canvasW: number, canvasH: number): TrackGeometry {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const rx = canvasW * 0.38;
  const ry = canvasH * 0.28;
  const width = Math.min(canvasW, canvasH) * 0.18;
  return { cx, cy, rx, ry, width };
}

// Convert track coords → screen coords
// trackPos: 0..1 (angle around oval, 0 = right side, goes clockwise)
// lane: 0..1 (0 = inner edge, 1 = outer edge)
export function trackToScreen(
  trackPos: number,
  lane: number,
  geo: TrackGeometry
): { x: number; y: number } {
  const angle = trackPos * Math.PI * 2;
  // Midline of the track band
  const midRx = geo.rx - geo.width / 2;
  const midRy = geo.ry - geo.width / 2;

  // Point on midline
  const mx = geo.cx + Math.cos(angle) * midRx;
  const my = geo.cy + Math.sin(angle) * midRy;

  // Outward normal at this angle
  const tanX = -Math.sin(angle) * midRx;
  const tanY =  Math.cos(angle) * midRy;
  const tanLen = Math.sqrt(tanX * tanX + tanY * tanY) || 1;
  // Normal = rotate tangent 90° outward
  const nx =  tanY / tanLen;
  const ny = -tanX / tanLen;

  // offset: lane 0.5 = midline, <0.5 = inner, >0.5 = outer
  const offset = (lane - 0.5) * geo.width;
  return { x: mx + nx * offset, y: my + ny * offset };
}

// Is a screen point on the track?
export function isOnTrack(sx: number, sy: number, geo: TrackGeometry): boolean {
  const outerRx = geo.rx;
  const outerRy = geo.ry;
  const innerRx = geo.rx - geo.width;
  const innerRy = geo.ry - geo.width;
  const dx = sx - geo.cx;
  const dy = sy - geo.cy;
  const outerDist = (dx * dx) / (outerRx * outerRx) + (dy * dy) / (outerRy * outerRy);
  const innerDist = (dx * dx) / (innerRx * innerRx) + (dy * dy) / (innerRy * innerRy);
  return outerDist <= 1 && innerDist >= 1;
}

// Wrap track position to 0..1
export function wrapPos(pos: number): number {
  return ((pos % 1) + 1) % 1;
}

// Angular distance from a to b (shortest signed path, positive = forward)
export function trackDelta(from: number, to: number): number {
  let d = to - from;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}
