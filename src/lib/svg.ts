// Small helpers for the hand-drawn SVG diagrams.

/** A chevron arrowhead whose tip sits at (x, y), pointing along (dx, dy). */
export function head(x: number, y: number, dx: number, dy: number, size = 8, spread = 5): string {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const bx = x - size * ux;
  const by = y - size * uy;
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(bx + spread * px)} ${f(by + spread * py)} L${f(x)} ${f(y)} L${f(bx - spread * px)} ${f(by - spread * py)}`;
}

export const DOWN = [0, 1] as const;
export const UP = [0, -1] as const;
export const LEFT = [-1, 0] as const;
export const RIGHT = [1, 0] as const;
