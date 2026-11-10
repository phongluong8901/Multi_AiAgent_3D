/**
 * Sinh ma mau HSL on dinh tu chuoi ID (User ID hoac Agent ID).
 * Giup cac the avatar va thanh phan giao dien co mau sac dac trung khong trung lap.
 * 
 * @param id Chuoi dinh danh (userId, agentId)
 * @param hueShift Do lech mau tuy chon
 * @returns Chuoi ma mau HSL hop le
 */
export function colorFromId(id: string, hueShift = 0): string {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360) + hueShift
    return `hsl(${h % 360} 70% 55%)`
}
