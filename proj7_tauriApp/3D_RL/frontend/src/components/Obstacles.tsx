/**
 * ==============================================================================
 * COMPONENT VẬT CẢN ĐÔ THỊ (OBSTACLES WRAPPER)
 * ==============================================================================
 * Trong phiên bản đại đô thị 100m x 100m, hệ thống vật cản tĩnh đã được nâng cấp
 * toàn diện thành 36 cụm công trình kiến trúc đô thị, xe cộ giao thông và công viên
 * thông qua component CityMap.
 */

import CityMap from "./CityMap";

export default function Obstacles() {
    return <CityMap />;
}
