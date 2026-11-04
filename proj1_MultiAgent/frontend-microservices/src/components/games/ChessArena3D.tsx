'use client'

import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float } from '@react-three/drei'
import * as THREE from 'three'

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k'
export type PieceColor = 'w' | 'b'

export type ChessPiece = {
    id: string
    type: PieceType
    color: PieceColor
    row: number // 0 to 7 (0 is rank 1, 7 is rank 8)
    col: number // 0 to 7 (0 is file a, 7 is file h)
    captured?: boolean
}

export type MoveRecord = {
    san: string
    color: PieceColor
    from: [number, number]
    to: [number, number]
    capturedPiece?: PieceType
    evalScore?: number
}

type ChessArena3DProps = {
    pieces: ChessPiece[]
    currentTurn: PieceColor
    whiteAgentName: string
    blackAgentName: string
    lastMove: { from: [number, number]; to: [number, number] } | null
    selectedSquare: [number, number] | null
    validMoves: [number, number][]
    isCheck: boolean
    checkSquare: [number, number] | null
    isGameOver: boolean
    gameResult: string | null
    onSquareClick?: (row: number, col: number) => void
    isPlayerMode?: boolean
    evalScore: number // centipawns (-10 to +10)
}

const BOARD_SIZE = 8
const SQUARE_SIZE = 1.6
const HALF_BOARD = (BOARD_SIZE * SQUARE_SIZE) / 2

// Chuyển đổi tọa độ cờ (row, col) thành tọa độ 3D không gian (x, z)
export function squareToWorld(row: number, col: number): [number, number] {
    const x = (col - 3.5) * SQUARE_SIZE
    const z = (3.5 - row) * SQUARE_SIZE
    return [x, z]
}

/** Component vẽ từng quân cờ 3D độc đáo theo hình dáng chuẩn */
function ChessPieceMesh({
    piece,
    isSelected,
    isTarget
}: {
    piece: ChessPiece
    isSelected: boolean
    isTarget: boolean
}) {
    const groupRef = useRef<THREE.Group>(null)
    const [targetX, targetZ] = useMemo(() => squareToWorld(piece.row, piece.col), [piece.row, piece.col])

    // Hoạt ảnh mượt mà khi quân cờ di chuyển
    useFrame((_, delta) => {
        if (!groupRef.current) return
        const curX = groupRef.current.position.x
        const curZ = groupRef.current.position.z
        const dx = targetX - curX
        const dz = targetZ - curZ
        const dist = Math.hypot(dx, dz)

        if (dist > 0.05) {
            // Khi đang bay di chuyển, nhấc bổng quân cờ lên một chút (hiệu ứng arc)
            groupRef.current.position.x = THREE.MathUtils.lerp(curX, targetX, delta * 12)
            groupRef.current.position.z = THREE.MathUtils.lerp(curZ, targetZ, delta * 12)
            groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0.45, delta * 15)
        } else {
            groupRef.current.position.x = targetX
            groupRef.current.position.z = targetZ
            groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * 15)
        }
    })

    const isWhite = piece.color === 'w'
    const baseColor = isWhite ? '#f8fafc' : '#0f172a'
    const emissiveColor = isSelected
        ? '#10b981'
        : isTarget
        ? '#ef4444'
        : isWhite
        ? '#93c5fd'
        : '#818cf8'

    const emissiveIntensity = isSelected ? 0.6 : isTarget ? 0.7 : 0.08
    const metalness = isWhite ? 0.35 : 0.7
    const roughness = isWhite ? 0.25 : 0.3

    const material = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color: baseColor,
                emissive: emissiveColor,
                emissiveIntensity,
                metalness,
                roughness
            }),
        [baseColor, emissiveColor, emissiveIntensity, metalness, roughness]
    )

    // Render hình khối 3D tùy theo loại quân cờ
    const renderGeometry = () => {
        switch (piece.type) {
            case 'p': // Tốt (Pawn)
                return (
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.15, 0]} material={material}>
                            <cylinderGeometry args={[0.32, 0.42, 0.3, 16]} />
                        </mesh>
                        <mesh position={[0, 0.45, 0]} material={material}>
                            <cylinderGeometry args={[0.2, 0.3, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.75, 0]} material={material}>
                            <sphereGeometry args={[0.24, 16, 16]} />
                        </mesh>
                    </group>
                )
            case 'r': // Xe (Rook - Thành trì)
                return (
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.2, 0]} material={material}>
                            <cylinderGeometry args={[0.42, 0.48, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.65, 0]} material={material}>
                            <cylinderGeometry args={[0.34, 0.38, 0.6, 16]} />
                        </mesh>
                        {/* Lâu đài răng cưa */}
                        <mesh position={[0, 1.05, 0]} material={material}>
                            <cylinderGeometry args={[0.42, 0.36, 0.25, 8]} />
                        </mesh>
                    </group>
                )
            case 'n': // Mã (Knight - Ngựa chiến)
                return (
                    <group position={[0, 0, 0]} rotation={[0, isWhite ? 0 : Math.PI, 0]}>
                        <mesh position={[0, 0.2, 0]} material={material}>
                            <cylinderGeometry args={[0.42, 0.48, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.65, 0]} rotation={[0.2, 0, 0]} material={material}>
                            <boxGeometry args={[0.36, 0.65, 0.45]} />
                        </mesh>
                        <mesh position={[0, 1.0, 0.12]} rotation={[-0.3, 0, 0]} material={material}>
                            <boxGeometry args={[0.3, 0.4, 0.35]} />
                        </mesh>
                    </group>
                )
            case 'b': // Tượng (Bishop - Mũ Giám mục)
                return (
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.2, 0]} material={material}>
                            <cylinderGeometry args={[0.4, 0.46, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.7, 0]} material={material}>
                            <cylinderGeometry args={[0.25, 0.35, 0.7, 16]} />
                        </mesh>
                        <mesh position={[0, 1.15, 0]} material={material}>
                            <sphereGeometry args={[0.26, 16, 16]} />
                        </mesh>
                        <mesh position={[0, 1.35, 0]} material={material}>
                            <sphereGeometry args={[0.08, 12, 12]} />
                        </mesh>
                    </group>
                )
            case 'q': // Hậu (Queen - Vương miện nữ hoàng)
                return (
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.2, 0]} material={material}>
                            <cylinderGeometry args={[0.45, 0.52, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.8, 0]} material={material}>
                            <cylinderGeometry args={[0.28, 0.4, 0.9, 16]} />
                        </mesh>
                        <mesh position={[0, 1.35, 0]} material={material}>
                            <cylinderGeometry args={[0.42, 0.28, 0.3, 16]} />
                        </mesh>
                        <mesh position={[0, 1.55, 0]} material={material}>
                            <sphereGeometry args={[0.13, 16, 16]} />
                        </mesh>
                    </group>
                )
            case 'k': // Vua (King - Thánh giá quyền lực)
                return (
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.2, 0]} material={material}>
                            <cylinderGeometry args={[0.46, 0.54, 0.4, 16]} />
                        </mesh>
                        <mesh position={[0, 0.85, 0]} material={material}>
                            <cylinderGeometry args={[0.3, 0.42, 1.0, 16]} />
                        </mesh>
                        <mesh position={[0, 1.45, 0]} material={material}>
                            <cylinderGeometry args={[0.45, 0.32, 0.3, 16]} />
                        </mesh>
                        {/* Biểu tượng Thánh giá */}
                        <mesh position={[0, 1.7, 0]} material={material}>
                            <boxGeometry args={[0.08, 0.25, 0.08]} />
                        </mesh>
                        <mesh position={[0, 1.74, 0]} material={material}>
                            <boxGeometry args={[0.22, 0.08, 0.08]} />
                        </mesh>
                    </group>
                )
        }
    }

    if (piece.captured) return null

    return (
        <group ref={groupRef} position={[targetX, 0, targetZ]}>
            {renderGeometry()}

            {/* Vòng hào quang nếu quân cờ được chọn */}
            {isSelected && (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.55, 0.72, 32]} />
                    <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    )
}

/** Bàn cờ 3D 8x8 với vật liệu cao cấp và tọa độ */
function ChessBoardMesh({
    lastMove,
    selectedSquare,
    validMoves,
    checkSquare,
    onSquareClick
}: {
    lastMove: { from: [number, number]; to: [number, number] } | null
    selectedSquare: [number, number] | null
    validMoves: [number, number][]
    checkSquare: [number, number] | null
    onSquareClick?: (row: number, col: number) => void
}) {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8']

    return (
        <group position={[0, 0, 0]}>
            {/* Khung gỗ viền bàn cờ sang trọng */}
            <mesh position={[0, -0.25, 0]} receiveShadow>
                <boxGeometry args={[BOARD_SIZE * SQUARE_SIZE + 1.2, 0.5, BOARD_SIZE * SQUARE_SIZE + 1.2]} />
                <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.5} />
            </mesh>

            {/* Viền kim loại mạ vàng neon */}
            <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[BOARD_SIZE * SQUARE_SIZE + 0.1, 0.02, BOARD_SIZE * SQUARE_SIZE + 0.1]} />
                <meshStandardMaterial color="#6366f1" emissive="#4f46e5" emissiveIntensity={0.2} metalness={0.8} />
            </mesh>

            {/* 64 ô cờ */}
            {Array.from({ length: 8 }).map((_, r) =>
                Array.from({ length: 8 }).map((_, c) => {
                    const isDark = (r + c) % 2 === 0
                    const [x, z] = squareToWorld(r, c)

                    const isLastMoveSquare =
                        lastMove &&
                        ((lastMove.from[0] === r && lastMove.from[1] === c) ||
                            (lastMove.to[0] === r && lastMove.to[1] === c))

                    const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c
                    const isValidTarget = validMoves.some((m) => m[0] === r && m[1] === c)
                    const isCheckSquare = checkSquare && checkSquare[0] === r && checkSquare[1] === c

                    let squareColor = isDark ? '#1e293b' : '#cbd5e1'
                    let emissiveColor = '#000000'
                    let emissiveIntensity = 0

                    if (isCheckSquare) {
                        squareColor = '#dc2626'
                        emissiveColor = '#ef4444'
                        emissiveIntensity = 0.5
                    } else if (isSelected) {
                        squareColor = '#059669'
                        emissiveColor = '#10b981'
                        emissiveIntensity = 0.4
                    } else if (isLastMoveSquare) {
                        squareColor = isDark ? '#3b82f6' : '#60a5fa'
                        emissiveColor = '#3b82f6'
                        emissiveIntensity = 0.3
                    }

                    return (
                        <group key={`${r}-${c}`} position={[x, 0, z]}>
                            <mesh
                                receiveShadow
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onSquareClick?.(r, c)
                                }}
                            >
                                <boxGeometry args={[SQUARE_SIZE, 0.08, SQUARE_SIZE]} />
                                <meshStandardMaterial
                                    color={squareColor}
                                    emissive={emissiveColor}
                                    emissiveIntensity={emissiveIntensity}
                                    roughness={0.3}
                                    metalness={0.4}
                                />
                            </mesh>

                            {/* Dấu chấm xanh hiển thị nước đi hợp lệ */}
                            {isValidTarget && (
                                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                    <circleGeometry args={[0.25, 24]} />
                                    <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
                                </mesh>
                            )}
                        </group>
                    )
                })
            )}

            {/* Nhãn Tọa độ Ranks (1-8) và Files (A-H) */}
            {files.map((f, idx) => {
                const [x] = squareToWorld(0, idx)
                return (
                    <React.Fragment key={`file-${f}`}>
                        <Text
                            position={[x, 0.02, HALF_BOARD + 0.35]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            fontSize={0.28}
                            color="#94a3b8"
                        >
                            {f}
                        </Text>
                        <Text
                            position={[x, 0.02, -HALF_BOARD - 0.35]}
                            rotation={[-Math.PI / 2, 0, Math.PI]}
                            fontSize={0.28}
                            color="#94a3b8"
                        >
                            {f}
                        </Text>
                    </React.Fragment>
                )
            })}

            {ranks.map((r, idx) => {
                const [, z] = squareToWorld(idx, 0)
                return (
                    <React.Fragment key={`rank-${r}`}>
                        <Text
                            position={[-HALF_BOARD - 0.35, 0.02, z]}
                            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                            fontSize={0.28}
                            color="#94a3b8"
                        >
                            {r}
                        </Text>
                        <Text
                            position={[HALF_BOARD + 0.35, 0.02, z]}
                            rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                            fontSize={0.28}
                            color="#94a3b8"
                        >
                            {r}
                        </Text>
                    </React.Fragment>
                )
            })}
        </group>
    )
}

/** Nghĩa địa quân cờ bị bắt ở hai bên sàn */
function CapturedPiecesRack({
    capturedPieces
}: {
    capturedPieces: ChessPiece[]
}) {
    const whiteCaptured = capturedPieces.filter((p) => p.color === 'w')
    const blackCaptured = capturedPieces.filter((p) => p.color === 'b')

    return (
        <group>
            {/* Quân Trắng bị bắt xếp ở sườn phải */}
            {whiteCaptured.map((p, idx) => {
                const z = -4.5 + (idx % 8) * 1.2
                const x = HALF_BOARD + 1.8 + Math.floor(idx / 8) * 0.9
                return (
                    <group key={`cap-w-${p.id}`} position={[x, -0.1, z]} scale={0.75}>
                        <mesh position={[0, 0.1, 0]}>
                            <cylinderGeometry args={[0.35, 0.4, 0.2, 16]} />
                            <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.3} />
                        </mesh>
                    </group>
                )
            })}

            {/* Quân Đen bị bắt xếp ở sườn trái */}
            {blackCaptured.map((p, idx) => {
                const z = -4.5 + (idx % 8) * 1.2
                const x = -HALF_BOARD - 1.8 - Math.floor(idx / 8) * 0.9
                return (
                    <group key={`cap-b-${p.id}`} position={[x, -0.1, z]} scale={0.75}>
                        <mesh position={[0, 0.1, 0]}>
                            <cylinderGeometry args={[0.35, 0.4, 0.2, 16]} />
                            <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.2} />
                        </mesh>
                    </group>
                )
            })}
        </group>
    )
}

export default function ChessArena3D({
    pieces,
    currentTurn,
    whiteAgentName,
    blackAgentName,
    lastMove,
    selectedSquare,
    validMoves,
    isCheck,
    checkSquare,
    isGameOver,
    gameResult,
    onSquareClick,
    isPlayerMode = false,
    evalScore
}: ChessArena3DProps) {
    const capturedPieces = useMemo(() => pieces.filter((p) => p.captured), [pieces])
    const activePieces = useMemo(() => pieces.filter((p) => !p.captured), [pieces])

    return (
        <div className="relative w-full h-[520px] rounded-3xl overflow-hidden bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-900 border border-zinc-800 shadow-2xl">
            {/* Header thông tin trận đấu phía trên */}
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                {/* Agent Trắng */}
                <div className="flex items-center gap-2.5 bg-zinc-900/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-zinc-800/80 shadow-lg">
                    <span
                        className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-300 bg-white shadow-sm ${
                            currentTurn === 'w' && !isGameOver ? 'ring-2 ring-blue-500 animate-pulse' : ''
                        }`}
                    />
                    <div>
                        <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                            {whiteAgentName}
                            <span className="text-[9px] px-1.5 py-0.2 bg-zinc-800 text-zinc-300 rounded-md font-mono">
                                TRẮNG
                            </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                            {isPlayerMode ? 'Người chơi điều khiển' : 'Agent RL (MCTS Lookahead)'}
                        </div>
                    </div>
                </div>

                {/* Thanh Đánh giá Thế trận (Evaluation Bar) */}
                <div className="flex flex-col items-center bg-zinc-900/80 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-zinc-800 shadow-lg">
                    <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Đánh giá Thế trận
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-mono font-bold ${evalScore >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                            {evalScore > 0 ? `+${evalScore.toFixed(1)}` : evalScore.toFixed(1)}
                        </span>
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                            <div
                                className="bg-blue-400 h-full transition-all duration-300"
                                style={{ width: `${Math.max(5, Math.min(95, 50 + evalScore * 5))}%` }}
                            />
                            <div
                                className="bg-rose-500 h-full transition-all duration-300"
                                style={{ width: `${Math.max(5, Math.min(95, 50 - evalScore * 5))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Agent Đen */}
                <div className="flex items-center gap-2.5 bg-zinc-900/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-zinc-800/80 shadow-lg">
                    <div className="text-right">
                        <div className="text-[11px] font-bold text-white flex items-center justify-end gap-1.5">
                            <span className="text-[9px] px-1.5 py-0.2 bg-zinc-950 text-zinc-400 rounded-md font-mono border border-zinc-800">
                                ĐEN
                            </span>
                            {blackAgentName}
                        </div>
                        <div className="text-[10px] text-zinc-400">Agent RL (Alpha-Beta Pruning)</div>
                    </div>
                    <span
                        className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-600 bg-zinc-950 shadow-sm ${
                            currentTurn === 'b' && !isGameOver ? 'ring-2 ring-purple-500 animate-pulse' : ''
                        }`}
                    />
                </div>
            </div>

            {/* Thông báo Chiếu Vua / Kết thúc trận */}
            {isCheck && !isGameOver && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-rose-600/90 text-white font-bold text-xs px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg shadow-rose-600/30 animate-bounce">
                    ⚠ CHIẾU TƯỚNG! (CHECK)
                </div>
            )}

            {isGameOver && (
                <div className="absolute inset-0 z-30 bg-zinc-950/75 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl text-center max-w-sm shadow-2xl space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl">
                            ♔
                        </div>
                        <h3 className="text-lg font-bold text-white">Ván Đấu Kết Thúc</h3>
                        <p className="text-xs text-zinc-300 font-medium">{gameResult}</p>
                    </div>
                </div>
            )}

            {/* Canvas 3D Three.js */}
            <Canvas
                shadows
                camera={{ position: [0, 11, 10.5], fov: 42 }}
                className="w-full h-full cursor-grab active:cursor-grabbing"
            >
                <ambientLight intensity={0.8} />
                <directionalLight position={[10, 18, 10]} intensity={1.6} castShadow shadow-mapSize={2048} />
                <pointLight position={[-10, 8, -10]} intensity={0.6} color="#6366f1" />
                <pointLight position={[10, 8, 10]} intensity={0.6} color="#38bdf8" />

                <ChessBoardMesh
                    lastMove={lastMove}
                    selectedSquare={selectedSquare}
                    validMoves={validMoves}
                    checkSquare={checkSquare}
                    onSquareClick={onSquareClick}
                />

                {activePieces.map((p) => {
                    const isSelected = selectedSquare && selectedSquare[0] === p.row && selectedSquare[1] === p.col
                    const isTarget = validMoves.some((m) => m[0] === p.row && m[1] === p.col)
                    return (
                        <ChessPieceMesh
                            key={p.id}
                            piece={p}
                            isSelected={Boolean(isSelected)}
                            isTarget={Boolean(isTarget)}
                        />
                    )
                })}

                <CapturedPiecesRack capturedPieces={capturedPieces} />

                <OrbitControls
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2.1}
                    minDistance={7}
                    maxDistance={22}
                    target={[0, 0, 0]}
                />
            </Canvas>

            {/* Hướng dẫn thao tác góc dưới */}
            <div className="absolute bottom-3 left-4 text-[10px] text-zinc-400 bg-zinc-900/60 backdrop-blur-md px-3 py-1 rounded-xl border border-zinc-800">
                Xoay 3D: Chuột Trái • Phóng to: Cuộn chuột • {isPlayerMode ? 'Bấm vào quân Trắng để đi cờ' : 'Hai Agent đang tự chơi đối kháng'}
            </div>
        </div>
    )
}
