export function getDepthColor(depth: number): string {
  const hue = (220 - depth * 40 + 360) % 360
  return `hsl(${hue}, 70%, 65%)`
}
