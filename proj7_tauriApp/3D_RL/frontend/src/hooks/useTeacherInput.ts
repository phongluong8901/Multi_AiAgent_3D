/**
 * ==============================================================================
 * HOOK ĐIỀU KHIỂN BÀN PHÍM TEACHER (KEYBOARD DIRECT DRIVE HOOK)
 * ==============================================================================
 * Khi Người Hướng Dẫn bật chế độ "Lái trực tiếp (WASD)" trong TeacherConsole:
 * - Lắng nghe các phím W, A, S, D và 4 phím mũi tên.
 * - Tránh bắt sự kiện khi người dùng đang nhập text vào INPUT/TEXTAREA.
 * - Chuẩn hóa vector vận tốc 2D [vx, vz] theo tốc độ tối đa MAX_TEACHER_SPEED (1.2m/s).
 * - Gửi vector hành động qua WebSocket tới backend mỗi 90ms.
 * - Nếu đang bật ghi hình (isRecordingDemo), backend sẽ tự động ghi mẫu vào SQLite.
 */

import { useEffect, useRef } from "react";
import { useTrainingStore } from "../stores/useTrainingStore";

const MAX_TEACHER_SPEED = 1.2;

export function useTeacherInput() {
    const isTeacherMode = useTrainingStore((s) => s.isTeacherMode);
    const sendTeacherAction = useTrainingStore((s) => s.sendTeacherAction);
    const pressedKeys = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isTeacherMode) {
            pressedKeys.current.clear();
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            const key = e.key.toLowerCase();
            if (
                ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
                    key
                )
            ) {
                e.preventDefault();
                pressedKeys.current.add(key);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            pressedKeys.current.delete(key);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        // Vòng lặp phát tín hiệu hành động 90ms/lần khi có phím đang giữ
        const interval = window.setInterval(() => {
            const keys = pressedKeys.current;
            if (keys.size === 0) return;

            let vx = 0;
            let vz = 0;

            if (keys.has("w") || keys.has("arrowup")) vz -= 1;
            if (keys.has("s") || keys.has("arrowdown")) vz += 1;
            if (keys.has("a") || keys.has("arrowleft")) vx -= 1;
            if (keys.has("d") || keys.has("arrowright")) vx += 1;

            const norm = Math.hypot(vx, vz);
            if (norm > 0) {
                const action: [number, number] = [
                    Number(((vx / norm) * MAX_TEACHER_SPEED).toFixed(3)),
                    Number(((vz / norm) * MAX_TEACHER_SPEED).toFixed(3)),
                ];
                sendTeacherAction(action);
            }
        }, 90);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.clearInterval(interval);
        };
    }, [isTeacherMode, sendTeacherAction]);
}
