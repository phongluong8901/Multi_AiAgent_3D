/**
 * characterRig.ts - Facade re-exporting procedural 3D character rigs
 *
 * Tách module thành các file con chuyên biệt:
 * - rigState.ts: Khung xương khớp chung và node trạng thái
 * - animeIdol/: Tạo hình, biểu cảm 2D canvas và diễn hoạt cho Cyber Idol
 * - microduck/: Tạo hình BDX Droid 12 DoF, màu sắc và diễn hoạt cho NVIDIA MicroDuck
 * - builtinRig.ts: Quản lý chuyển đổi và điều phối animation loop
 */

export * from './rigState';
export * from './animeIdol/animeFace';
export * from './animeIdol/animeModel';
export * from './animeIdol/animeAnimation';
export * from './microduck/microduckModel';
export * from './microduck/microduckAnimation';
export * from './builtinRig';
export * from './accessories3d';
