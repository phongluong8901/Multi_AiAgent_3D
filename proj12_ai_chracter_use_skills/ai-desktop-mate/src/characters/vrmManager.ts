/**
 * vrmManager.ts - Facade re-exporting VRM & GLB 3D model loaders and animations
 *
 * Tách module thành các file con chuyên biệt:
 * - vrm/vrmCache.ts: Lưu trữ và nạp cache IndexedDB
 * - vrm/vrmLoader.ts: Nạp file .vrm / .glb với DRACOLoader và VRMLoaderPlugin
 * - vrm/vrmAnimation.ts: Diễn hoạt xương humanoid chuẩn VRM và GLB generic
 */

export * from './vrm/vrmCache';
export * from './vrm/vrmLoader';
export * from './vrm/vrmAnimation';
