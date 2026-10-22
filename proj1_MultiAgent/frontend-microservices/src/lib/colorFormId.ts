// src/lib/colorFromId.ts
export function colorFromId(id: string, hueShift = 0): string {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360) + hueShift
    return `hsl(${h % 360} 70% 55%)`
}