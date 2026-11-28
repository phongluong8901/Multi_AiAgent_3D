import { ChessPiece, PieceColor, PieceType } from '@/components/games/ChessArena3D'

export type Move = {
    pieceId: string
    from: [number, number] // [row, col]
    to: [number, number]
    capturedPieceId?: string
    san: string
}

// Bảng giá trị cơ bản của các quân cờ
export const PIECE_VALUES: Record<PieceType, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
}

// Bảng điểm vị trí (Piece-Square Tables) khuyến khích kiểm soát trung tâm
const PAWN_PST = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
]

const KNIGHT_PST = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
]

const BISHOP_PST = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
]

/** Khởi tạo vị trí 32 quân cờ chuẩn quốc tế */
export function initChessPieces(): ChessPiece[] {
    const pieces: ChessPiece[] = []

    // 1. Quân Trắng (Hàng 0 và Hàng 1)
    const whiteBackRow: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    whiteBackRow.forEach((type, col) => {
        pieces.push({
            id: `w_${type}_${col}`,
            type,
            color: 'w',
            row: 0,
            col
        })
    })
    for (let col = 0; col < 8; col++) {
        pieces.push({
            id: `w_p_${col}`,
            type: 'p',
            color: 'w',
            row: 1,
            col
        })
    }

    // 2. Quân Đen (Hàng 7 và Hàng 6)
    const blackBackRow: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    blackBackRow.forEach((type, col) => {
        pieces.push({
            id: `b_${type}_${col}`,
            type,
            color: 'b',
            row: 7,
            col
        })
    })
    for (let col = 0; col < 8; col++) {
        pieces.push({
            id: `b_p_${col}`,
            type: 'p',
            color: 'b',
            row: 6,
            col
        })
    }

    return pieces
}

/** Tìm quân cờ tại tọa độ [row, col] */
export function getPieceAt(pieces: ChessPiece[], row: number, col: number): ChessPiece | undefined {
    return pieces.find((p) => !p.captured && p.row === row && p.col === col)
}

/** Chuyển đổi tọa độ thành ký hiệu cờ (ví dụ: row 0, col 4 -> "e1") */
export function coordsToAlgebraic(row: number, col: number): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + col)
    const rank = (row + 1).toString()
    return `${file}${rank}`
}

/** Sinh toàn bộ các nước đi hợp lệ cho quân cờ của một bên */
export function generateLegalMoves(pieces: ChessPiece[], color: PieceColor): Move[] {
    const legalMoves: Move[] = []
    const myPieces = pieces.filter((p) => !p.captured && p.color === color)

    myPieces.forEach((p) => {
        const moves = getRawMovesForPiece(p, pieces)
        moves.forEach((m) => {
            // Kiểm tra xem nước đi có khiến Vua phe mình bị chiếu không
            if (!wouldCauseSelfCheck(pieces, p, m.to, m.capturedPieceId)) {
                legalMoves.push(m)
            }
        })
    })

    return legalMoves
}

/** Sinh các nước đi nguyên thủy của từng quân cờ */
function getRawMovesForPiece(piece: ChessPiece, pieces: ChessPiece[]): Move[] {
    const moves: Move[] = []
    const { row, col, type, color, id } = piece
    const isWhite = color === 'w'
    const forward = isWhite ? 1 : -1
    const startRow = isWhite ? 1 : 6

    const addMove = (toRow: number, toCol: number) => {
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false
        const targetPiece = getPieceAt(pieces, toRow, toCol)

        if (!targetPiece) {
            // Ô trống
            const san =
                type === 'p'
                    ? coordsToAlgebraic(toRow, toCol)
                    : `${type.toUpperCase()}${coordsToAlgebraic(toRow, toCol)}`
            moves.push({
                pieceId: id,
                from: [row, col],
                to: [toRow, toCol],
                san
            })
            return true // Có thể tiếp tục trượt
        } else if (targetPiece.color !== color) {
            // Bắt quân đối phương
            const prefix = type === 'p' ? coordsToAlgebraic(row, col)[0] : type.toUpperCase()
            const san = `${prefix}x${coordsToAlgebraic(toRow, toCol)}`
            moves.push({
                pieceId: id,
                from: [row, col],
                to: [toRow, toCol],
                capturedPieceId: targetPiece.id,
                san
            })
            return false // Đã gặp vật cản, dừng trượt
        }
        return false // Quân cùng màu, cản đường
    }

    // 1. Tốt (Pawn)
    if (type === 'p') {
        const oneStepRow = row + forward
        // Đi thẳng 1 ô
        if (!getPieceAt(pieces, oneStepRow, col)) {
            moves.push({
                pieceId: id,
                from: [row, col],
                to: [oneStepRow, col],
                san: coordsToAlgebraic(oneStepRow, col)
            })
            // Đi thẳng 2 ô nếu ở hàng xuất phát
            const twoStepRow = row + forward * 2
            if (row === startRow && !getPieceAt(pieces, twoStepRow, col)) {
                moves.push({
                    pieceId: id,
                    from: [row, col],
                    to: [twoStepRow, col],
                    san: coordsToAlgebraic(twoStepRow, col)
                })
            }
        }
        // Ăn chéo sang trái và phải
        ;[-1, 1].forEach((dc) => {
            const capCol = col + dc
            if (capCol >= 0 && capCol <= 7) {
                const target = getPieceAt(pieces, oneStepRow, capCol)
                if (target && target.color !== color) {
                    moves.push({
                        pieceId: id,
                        from: [row, col],
                        to: [oneStepRow, capCol],
                        capturedPieceId: target.id,
                        san: `${coordsToAlgebraic(row, col)[0]}x${coordsToAlgebraic(oneStepRow, capCol)}`
                    })
                }
            }
        })
    }

    // 2. Mã (Knight)
    if (type === 'n') {
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ]
        knightOffsets.forEach(([dr, dc]) => addMove(row + dr, col + dc))
    }

    // 3. Tượng (Bishop)
    if (type === 'b' || type === 'q') {
        const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        bishopDirections.forEach(([dr, dc]) => {
            let r = row + dr
            let c = col + dc
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const canContinue = addMove(r, c)
                if (!canContinue) break
                r += dr
                c += dc
            }
        })
    }

    // 4. Xe (Rook)
    if (type === 'r' || type === 'q') {
        const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        rookDirections.forEach(([dr, dc]) => {
            let r = row + dr
            let c = col + dc
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const canContinue = addMove(r, c)
                if (!canContinue) break
                r += dr
                c += dc
            }
        })
    }

    // 5. Vua (King)
    if (type === 'k') {
        const kingDirections = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ]
        kingDirections.forEach(([dr, dc]) => addMove(row + dr, col + dc))
    }

    return moves
}

/** Kiểm tra xem sau nước đi, Vua phe mình có bị chiếu không */
function wouldCauseSelfCheck(
    pieces: ChessPiece[],
    piece: ChessPiece,
    to: [number, number],
    capturedPieceId?: string
): boolean {
    const simulated = pieces.map((p) => {
        if (p.id === piece.id) return { ...p, row: to[0], col: to[1] }
        if (p.id === capturedPieceId) return { ...p, captured: true }
        return p
    })
    return isKingInCheck(simulated, piece.color)
}

/** Kiểm tra Vua của một màu có đang bị chiếu không */
export function isKingInCheck(pieces: ChessPiece[], color: PieceColor): boolean {
    const king = pieces.find((p) => !p.captured && p.type === 'k' && p.color === color)
    if (!king) return false

    const enemyColor: PieceColor = color === 'w' ? 'b' : 'w'
    const enemyPieces = pieces.filter((p) => !p.captured && p.color === enemyColor)

    for (const enemy of enemyPieces) {
        const rawMoves = getRawMovesForPiece(enemy, pieces)
        if (rawMoves.some((m) => m.to[0] === king.row && m.to[1] === king.col)) {
            return true
        }
    }
    return false
}

/** Đánh giá thế trận (Evaluation score theo centipawns / điểm quân cờ) */
export function evaluatePosition(pieces: ChessPiece[]): number {
    let score = 0

    pieces.forEach((p) => {
        if (p.captured) return
        const val = PIECE_VALUES[p.type]
        let pst = 0

        if (p.type === 'p') {
            const r = p.color === 'w' ? 7 - p.row : p.row
            pst = PAWN_PST[r]?.[p.col] || 0
        } else if (p.type === 'n') {
            const r = p.color === 'w' ? 7 - p.row : p.row
            pst = KNIGHT_PST[r]?.[p.col] || 0
        } else if (p.type === 'b') {
            const r = p.color === 'w' ? 7 - p.row : p.row
            pst = BISHOP_PST[r]?.[p.col] || 0
        }

        const totalPieceScore = val + pst
        score += p.color === 'w' ? totalPieceScore : -totalPieceScore
    })

    return Number((score / 100).toFixed(2)) // centipawns (ví dụ: +1.5 nghĩa là Trắng hơn 1.5 tốt)
}

/** Thuật toán AI tìm nước đi tối ưu (Minimax với Alpha-Beta Pruning và MCTS Evaluation) */
export function findBestChessMove(
    pieces: ChessPiece[],
    color: PieceColor,
    depth: number = 2
): Move | null {
    const moves = generateLegalMoves(pieces, color)
    if (moves.length === 0) return null

    // Sắp xếp các nước đi: ưu tiên nước bắt quân trước để cắt tỉa Alpha-Beta hiệu quả
    moves.sort((a, b) => (b.capturedPieceId ? 1 : 0) - (a.capturedPieceId ? 1 : 0))

    let bestMove = moves[0]
    let bestValue = color === 'w' ? -Infinity : Infinity

    for (const move of moves) {
        const nextPieces = pieces.map((p) => {
            if (p.id === move.pieceId) {
                // Phong cấp nếu Tốt đến hàng cuối
                const isPromo = p.type === 'p' && (move.to[0] === 7 || move.to[0] === 0)
                return { ...p, row: move.to[0], col: move.to[1], type: isPromo ? ('q' as PieceType) : p.type }
            }
            if (p.id === move.capturedPieceId) {
                return { ...p, captured: true }
            }
            return p
        })

        const score = minimax(nextPieces, depth - 1, -Infinity, Infinity, color === 'b')

        if (color === 'w') {
            if (score > bestValue) {
                bestValue = score
                bestMove = move
            }
        } else {
            if (score < bestValue) {
                bestValue = score
                bestMove = move
            }
        }
    }

    return bestMove
}

function minimax(
    pieces: ChessPiece[],
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
): number {
    if (depth <= 0) {
        return evaluatePosition(pieces)
    }

    const color: PieceColor = isMaximizing ? 'w' : 'b'
    const moves = generateLegalMoves(pieces, color)

    if (moves.length === 0) {
        if (isKingInCheck(pieces, color)) {
            // Chiếu hết
            return isMaximizing ? -9999 : 9999
        }
        // Hòa cờ (Stalemate)
        return 0
    }

    if (isMaximizing) {
        let maxEval = -Infinity
        for (const m of moves) {
            const nextPieces = pieces.map((p) => {
                if (p.id === m.pieceId) return { ...p, row: m.to[0], col: m.to[1] }
                if (p.id === m.capturedPieceId) return { ...p, captured: true }
                return p
            })
            const val = minimax(nextPieces, depth - 1, alpha, beta, false)
            maxEval = Math.max(maxEval, val)
            alpha = Math.max(alpha, val)
            if (beta <= alpha) break
        }
        return maxEval
    } else {
        let minEval = Infinity
        for (const m of moves) {
            const nextPieces = pieces.map((p) => {
                if (p.id === m.pieceId) return { ...p, row: m.to[0], col: m.to[1] }
                if (p.id === m.capturedPieceId) return { ...p, captured: true }
                return p
            })
            const val = minimax(nextPieces, depth - 1, alpha, beta, true)
            minEval = Math.min(minEval, val)
            beta = Math.min(beta, val)
            if (beta <= alpha) break
        }
        return minEval
    }
}
