/**
 * Agent Body Studio - domain types & helpers.
 *
 * Mô hình động học dạng cây (kinematic tree) tương thích URDF:
 * - Link: khối cứng (box / sphere / cylinder / capsule) có khối lượng.
 * - Joint: nối 1 link cha với 1 link con, có trục quay/trượt, giới hạn và motor (actuated).
 *
 * Quy ước hệ trục trong Studio: Y-up (three.js), hướng tiến của robot là +X.
 * Mọi góc Euler (originRotation / visualRotation) dùng thứ tự 'ZYX' => R = Rz * Ry * Rx,
 * trùng với quy ước rpy của URDF để xuất file chính xác.
 */

export type Vec3 = [number, number, number]
export type LinkShape =
    | 'box'
    | 'sphere'
    | 'cylinder'
    | 'capsule'
    | 'cone'
    | 'torus'
    | 'gear'
    | 'wedge'
    | 'spring'
    | 'extrusion'

export interface ShapeParams {
    teeth?: number
    innerRadius?: number
    profile?: 'i-beam' | 'c-channel' | 'hex' | 'aerofoil'
    coils?: number
    wireRadius?: number
    tubeRadius?: number
    bevel?: boolean
}
export type JointType = 'revolute' | 'continuous' | 'prismatic' | 'fixed'

export interface AgentLink {
    id: string
    name: string
    shape: LinkShape
    /** box: [x, y, z]; sphere: [r, -, -]; cylinder / capsule: [r, length, -] (dọc trục Y) */
    size: Vec3
    color: string
    mass: number
    visualOffset: Vec3
    visualRotation: Vec3
    isContactSensor?: boolean
    shapeParams?: ShapeParams
}

export interface JointLimit {
    lower: number
    upper: number
    effort: number
    velocity: number
}

export interface AgentJoint {
    id: string
    name: string
    type: JointType
    parentLinkId: string
    childLinkId: string
    origin: Vec3
    originRotation: Vec3
    axis: Vec3
    limit: JointLimit
    damping: number
    friction: number
    actuated: boolean
    defaultPosition: number
}

export interface AgentBodyDesign {
    bodyId?: string
    name: string
    description?: string
    category: string
    rootLinkId: string
    spawnHeight: number
    links: AgentLink[]
    joints: AgentJoint[]
    updatedAt?: string
}

export interface BodyStats {
    linkCount: number
    jointCount: number
    dof: number
    actionDim: number
    observationDim: number
    totalMass: number
}

// ─── ID & math helpers ─────────────────────────────────────────

let idCounter = 0
export function uid(prefix: string): string {
    idCounter = (idCounter + 1) % 100000
    return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export const DEG = Math.PI / 180
export const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d

export function halfHeight(link: AgentLink): number {
    const [a, b] = link.size
    switch (link.shape) {
        case 'sphere':
            return a
        case 'capsule':
            return b / 2 + a
        default:
            return b / 2
    }
}

export function halfDepth(link: AgentLink): number {
    const [a, , c] = link.size
    return link.shape === 'box' ? c / 2 : a
}

// ─── Factories ─────────────────────────────────────────────────

export function makeLink(partial: Partial<AgentLink> & { name: string }): AgentLink {
    return {
        id: partial.id ?? uid('link'),
        shape: 'box',
        size: [0.2, 0.2, 0.2],
        color: '#94a3b8',
        mass: 1,
        visualOffset: [0, 0, 0],
        visualRotation: [0, 0, 0],
        isContactSensor: false,
        ...partial,
    }
}

export function makeJoint(
    partial: Partial<AgentJoint> & { name: string; parentLinkId: string; childLinkId: string }
): AgentJoint {
    return {
        id: partial.id ?? uid('joint'),
        type: 'revolute',
        origin: [0, 0, 0],
        originRotation: [0, 0, 0],
        axis: [0, 0, 1],
        limit: { lower: -90 * DEG, upper: 90 * DEG, effort: 20, velocity: 5 },
        damping: 0.1,
        friction: 0,
        actuated: true,
        defaultPosition: 0,
        ...partial,
    }
}

// ─── Part catalog (thư viện bộ phận) ───────────────────────────

export type PartKind =
    | 'box'
    | 'sphere'
    | 'cylinder'
    | 'capsule'
    | 'cone'
    | 'torus'
    | 'gear'
    | 'wedge'
    | 'spring'
    | 'extrusion'
    | 'wheel'
    | 'limb'
    | 'gripper'
    | 'lidar_turret'
    | 'piston'
    | 'armor'

export interface PartCatalogItem {
    kind: PartKind
    name: string
    description: string
    category?: 'basic' | 'advanced' | 'assembly'
}

export const PART_CATALOG: PartCatalogItem[] = [
    // 1. Khối Cơ Bản (Basic)
    { kind: 'box', name: 'Khối hộp', description: 'Thân, bàn chân, tấm khung', category: 'basic' },
    { kind: 'capsule', name: 'Capsule (xương)', description: 'Đùi, cẳng chân, cánh tay', category: 'basic' },
    { kind: 'cylinder', name: 'Trụ tròn', description: 'Đế xoay, khớp trục, thân trụ', category: 'basic' },
    { kind: 'sphere', name: 'Khối cầu', description: 'Đầu, khớp cầu, bánh caster', category: 'basic' },

    // 2. Hình Học Cơ Khí Phức Tạp (Three.js Advanced Parametric)
    { kind: 'gear', name: 'Bánh răng nhông', description: 'Bánh răng cơ khí n-răng truyền động', category: 'advanced' },
    { kind: 'torus', name: 'Vành xuyến / Lốp', description: 'Vành lốp đệm, vòng bảo vệ cánh', category: 'advanced' },
    { kind: 'cone', name: 'Chóp nón', description: 'Mũi chóp khí động, vòi phun xả', category: 'advanced' },
    { kind: 'wedge', name: 'Nêm vát giáp', description: 'Tấm vát nghiêng 45°, đế móng vát', category: 'advanced' },
    { kind: 'spring', name: 'Lò xo giảm chấn', description: 'Lò xo xoắn helix chân robot', category: 'advanced' },
    { kind: 'extrusion', name: 'Đùn dầm chữ I', description: 'Thanh dầm chịu lực dập khuôn', category: 'advanced' },

    // 3. Cụm Linh Kiện Lắp Sẵn (Complex Assemblies)
    { kind: 'gripper', name: 'Càng kẹp 2 ngón', description: 'Ngàm kẹp gắp servo tự động', category: 'assembly' },
    { kind: 'lidar_turret', name: 'Lidar 360°', description: 'Đầu cảm biến quét quang học', category: 'assembly' },
    { kind: 'piston', name: 'Piston thủy lực', description: 'Xilanh trượt tịnh tiến giảm xóc', category: 'assembly' },
    { kind: 'armor', name: 'Giáp bảo vệ Cyber', description: 'Tấm khiên góc cạnh chống va đập', category: 'assembly' },
    { kind: 'wheel', name: 'Bánh xe', description: 'Bánh xe + khớp quay liên tục', category: 'assembly' },
    { kind: 'limb', name: 'Chi 2 đốt', description: 'Đùi + cẳng + 2 khớp gối', category: 'assembly' },
]

/**
 * Tạo bộ phận mới gắn vào `parent`. Trả về các link + joint cần thêm và id link được chọn.
 */
export function createPart(
    kind: PartKind,
    parent: AgentLink,
    existingCount: number
): { links: AgentLink[]; joints: AgentJoint[]; selectId: string } {
    const n = existingCount + 1
    const below = (child: AgentLink): Vec3 => [
        parent.visualOffset[0],
        parent.visualOffset[1] - halfHeight(parent),
        parent.visualOffset[2],
    ]
    const hang = (child: AgentLink): Vec3 => [0, -halfHeight(child), 0]

    if (kind === 'wheel') {
        const wheel = makeLink({
            name: `wheel_${n}`,
            shape: 'cylinder',
            size: [0.12, 0.06, 0],
            color: '#27272a',
            mass: 0.5,
            visualRotation: [90 * DEG, 0, 0],
            isContactSensor: true,
        })
        const joint = makeJoint({
            name: `wheel_${n}_joint`,
            type: 'continuous',
            parentLinkId: parent.id,
            childLinkId: wheel.id,
            origin: [parent.visualOffset[0], parent.visualOffset[1], parent.visualOffset[2] + halfDepth(parent) + 0.04],
            axis: [0, 0, 1],
            limit: { lower: -Math.PI, upper: Math.PI, effort: 10, velocity: 15 },
        })
        return { links: [wheel], joints: [joint], selectId: wheel.id }
    }

    if (kind === 'limb') {
        const upper = makeLink({ name: `upper_${n}`, shape: 'capsule', size: [0.04, 0.22, 0], color: '#60a5fa', mass: 0.6 })
        upper.visualOffset = hang(upper)
        const lower = makeLink({
            name: `lower_${n}`,
            shape: 'capsule',
            size: [0.035, 0.22, 0],
            color: '#93c5fd',
            mass: 0.4,
            isContactSensor: true,
        })
        lower.visualOffset = hang(lower)
        const hip = makeJoint({
            name: `hip_${n}`,
            parentLinkId: parent.id,
            childLinkId: upper.id,
            origin: below(upper),
            limit: { lower: -60 * DEG, upper: 60 * DEG, effort: 30, velocity: 6 },
        })
        const knee = makeJoint({
            name: `knee_${n}`,
            parentLinkId: upper.id,
            childLinkId: lower.id,
            origin: [0, -halfHeight(upper) * 2, 0],
            limit: { lower: -120 * DEG, upper: 0, effort: 25, velocity: 6 },
        })
        return { links: [upper, lower], joints: [hip, knee], selectId: upper.id }
    }

    // 1. Càng kẹp robot 2 ngón (Gripper Assembly)
    if (kind === 'gripper') {
        const base = makeLink({ name: `gripper_base_${n}`, shape: 'box', size: [0.1, 0.05, 0.08], color: '#334155', mass: 0.5 })
        base.visualOffset = hang(base)
        const fLeft = makeLink({ name: `finger_l_${n}`, shape: 'box', size: [0.02, 0.08, 0.02], color: '#38bdf8', mass: 0.1, visualOffset: [0, -0.04, 0] })
        const fRight = makeLink({ name: `finger_r_${n}`, shape: 'box', size: [0.02, 0.08, 0.02], color: '#38bdf8', mass: 0.1, visualOffset: [0, -0.04, 0] })
        const jBase = makeJoint({ name: `gripper_${n}_joint`, parentLinkId: parent.id, childLinkId: base.id, origin: below(base) })
        const jLeft = makeJoint({ name: `f_l_${n}_joint`, parentLinkId: base.id, childLinkId: fLeft.id, origin: [-0.035, -0.05, 0], limit: { lower: 0, upper: 30 * DEG, effort: 15, velocity: 8 } })
        const jRight = makeJoint({ name: `f_r_${n}_joint`, parentLinkId: base.id, childLinkId: fRight.id, origin: [0.035, -0.05, 0], limit: { lower: -30 * DEG, upper: 0, effort: 15, velocity: 8 } })
        return { links: [base, fLeft, fRight], joints: [jBase, jLeft, jRight], selectId: base.id }
    }

    // 2. Đầu cảm biến Lidar 360 (Lidar Turret Assembly)
    if (kind === 'lidar_turret') {
        const turretBase = makeLink({ name: `turret_base_${n}`, shape: 'cylinder', size: [0.07, 0.04, 0], color: '#1e293b', mass: 0.3 })
        turretBase.visualOffset = [0, halfHeight(parent) + 0.02, 0]
        const scanner = makeLink({ name: `lidar_dome_${n}`, shape: 'cylinder', size: [0.06, 0.05, 0], color: '#0ea5e9', mass: 0.2, visualOffset: [0, 0.025, 0] })
        const jMount = makeJoint({ name: `turret_${n}_mount`, type: 'fixed', parentLinkId: parent.id, childLinkId: turretBase.id, origin: [0, halfHeight(parent), 0], actuated: false })
        const jSpin = makeJoint({ name: `lidar_${n}_spin`, type: 'continuous', parentLinkId: turretBase.id, childLinkId: scanner.id, origin: [0, 0.04, 0], axis: [0, 1, 0], limit: { lower: -Math.PI, upper: Math.PI, effort: 5, velocity: 20 } })
        return { links: [turretBase, scanner], joints: [jMount, jSpin], selectId: scanner.id }
    }

    // 3. Piston thủy lực trượt (Hydraulic Piston Assembly)
    if (kind === 'piston') {
        const cylinder = makeLink({ name: `piston_cyl_${n}`, shape: 'cylinder', size: [0.03, 0.18, 0], color: '#eab308', mass: 0.8 })
        cylinder.visualOffset = hang(cylinder)
        const rod = makeLink({ name: `piston_rod_${n}`, shape: 'cylinder', size: [0.018, 0.18, 0], color: '#e2e8f0', mass: 0.3, visualOffset: [0, -0.09, 0] })
        const jCyl = makeJoint({ name: `piston_${n}_mount`, parentLinkId: parent.id, childLinkId: cylinder.id, origin: below(cylinder) })
        const jSlide = makeJoint({ name: `piston_${n}_stroke`, type: 'prismatic', parentLinkId: cylinder.id, childLinkId: rod.id, origin: [0, -0.18, 0], axis: [0, 1, 0], limit: { lower: 0, upper: 0.1, effort: 60, velocity: 3 } })
        return { links: [cylinder, rod], joints: [jCyl, jSlide], selectId: cylinder.id }
    }

    // 4. Giáp bảo vệ Cyber vát góc (Armor Plate)
    if (kind === 'armor') {
        const armor = makeLink({ name: `armor_${n}`, shape: 'wedge', size: [0.25, 0.15, 0.06], color: '#64748b', mass: 0.6 })
        armor.visualOffset = [0, 0, halfDepth(parent) + 0.03]
        const jArmor = makeJoint({ name: `armor_${n}_mount`, type: 'fixed', parentLinkId: parent.id, childLinkId: armor.id, origin: [0, 0, halfDepth(parent)], actuated: false })
        return { links: [armor], joints: [jArmor], selectId: armor.id }
    }

    // 5. Các hình khối đơn lẻ (Basic & Advanced Shapes)
    const presets: Record<string, Partial<AgentLink>> = {
        box: { shape: 'box', size: [0.2, 0.1, 0.2], color: '#a1a1aa' },
        capsule: { shape: 'capsule', size: [0.04, 0.2, 0], color: '#60a5fa', mass: 0.5 },
        cylinder: { shape: 'cylinder', size: [0.06, 0.15, 0], color: '#f59e0b', mass: 0.6 },
        sphere: { shape: 'sphere', size: [0.08, 0, 0], color: '#22d3ee', mass: 0.4 },
        gear: { shape: 'gear', size: [0.12, 0.03, 0], color: '#a855f7', mass: 0.7, shapeParams: { teeth: 12, innerRadius: 0.02 } },
        torus: { shape: 'torus', size: [0.12, 0.04, 0], color: '#ec4899', mass: 0.6, shapeParams: { tubeRadius: 0.03 } },
        cone: { shape: 'cone', size: [0.07, 0.16, 0], color: '#f97316', mass: 0.3 },
        wedge: { shape: 'wedge', size: [0.16, 0.12, 0.16], color: '#14b8a6', mass: 0.5 },
        spring: { shape: 'spring', size: [0.05, 0.2, 0], color: '#eab308', mass: 0.4, shapeParams: { coils: 5, wireRadius: 0.008 } },
        extrusion: { shape: 'extrusion', size: [0.08, 0.12, 0.25], color: '#3b82f6', mass: 1.2, shapeParams: { profile: 'i-beam' } },
    }
    const link = makeLink({ name: `${kind}_${n}`, ...(presets[kind] || presets.box) })
    link.visualOffset = hang(link)
    const joint = makeJoint({
        name: `${kind}_${n}_joint`,
        parentLinkId: parent.id,
        childLinkId: link.id,
        origin: below(link),
    })
    return { links: [link], joints: [joint], selectId: link.id }
}

// ─── Tree operations ───────────────────────────────────────────

export function getParentJoint(design: AgentBodyDesign, linkId: string): AgentJoint | undefined {
    return design.joints.find((j) => j.childLinkId === linkId)
}

export function getChildJoints(design: AgentBodyDesign, linkId: string): AgentJoint[] {
    return design.joints.filter((j) => j.parentLinkId === linkId)
}

export function getDescendantLinkIds(design: AgentBodyDesign, linkId: string): Set<string> {
    const out = new Set<string>([linkId])
    const stack = [linkId]
    while (stack.length) {
        const cur = stack.pop() as string
        for (const j of getChildJoints(design, cur)) {
            if (!out.has(j.childLinkId)) {
                out.add(j.childLinkId)
                stack.push(j.childLinkId)
            }
        }
    }
    return out
}

export function removeSubtree(design: AgentBodyDesign, linkId: string): AgentBodyDesign {
    if (linkId === design.rootLinkId) return design
    const doomed = getDescendantLinkIds(design, linkId)
    return {
        ...design,
        links: design.links.filter((l) => !doomed.has(l.id)),
        joints: design.joints.filter((j) => !doomed.has(j.childLinkId)),
    }
}

function swapSideName(name: string): string {
    const pairs: [RegExp, string][] = [
        [/left/g, '\u0000right'],
        [/right/g, '\u0000left'],
        [/Left/g, '\u0000Right'],
        [/Right/g, '\u0000Left'],
        [/_L\b/g, '\u0000_R'],
        [/_R\b/g, '\u0000_L'],
        [/(^|_)l_/g, '$1\u0000r_'],
        [/(^|_)r_/g, '$1\u0000l_'],
    ]
    let out = name
    for (const [re, rep] of pairs) out = out.replace(re, rep)
    out = out.replace(/\u0000/g, '')
    return out === name ? `${name}_mirror` : out
}

const mirrorVec = (v: Vec3): Vec3 => [v[0], v[1], -v[2]]
const mirrorAxis = (v: Vec3): Vec3 => [-v[0], -v[1], v[2]]
const mirrorRot = (v: Vec3): Vec3 => [-v[0], -v[1], v[2]]

/**
 * Nhân bản một nhánh (link + toàn bộ con cháu).
 * mirror = true: đối xứng qua mặt phẳng XY (trái <-> phải theo trục Z) - dùng cho chân / tay.
 */
export function duplicateSubtree(
    design: AgentBodyDesign,
    linkId: string,
    mirror: boolean
): { design: AgentBodyDesign; newRootId: string } | null {
    const rootJoint = getParentJoint(design, linkId)
    if (!rootJoint) return null
    const ids = getDescendantLinkIds(design, linkId)
    const idMap = new Map<string, string>()
    ids.forEach((id) => idMap.set(id, uid('link')))

    const newLinks: AgentLink[] = design.links
        .filter((l) => ids.has(l.id))
        .map((l) => ({
            ...l,
            id: idMap.get(l.id) as string,
            name: mirror ? swapSideName(l.name) : `${l.name}_copy`,
            visualOffset: mirror ? mirrorVec(l.visualOffset) : [...l.visualOffset],
            visualRotation: mirror ? mirrorRot(l.visualRotation) : [...l.visualRotation],
        }))

    const newJoints: AgentJoint[] = design.joints
        .filter((j) => ids.has(j.childLinkId))
        .map((j) => {
            const isRoot = j.id === rootJoint.id
            const origin: Vec3 = mirror
                ? mirrorVec(j.origin)
                : isRoot
                  ? [j.origin[0] + 0.1, j.origin[1], j.origin[2]]
                  : [...j.origin]
            return {
                ...j,
                id: uid('joint'),
                name: mirror ? swapSideName(j.name) : `${j.name}_copy`,
                parentLinkId: isRoot ? j.parentLinkId : (idMap.get(j.parentLinkId) as string),
                childLinkId: idMap.get(j.childLinkId) as string,
                origin,
                originRotation: mirror ? mirrorRot(j.originRotation) : [...j.originRotation],
                axis: mirror ? mirrorAxis(j.axis) : [...j.axis],
                limit: { ...j.limit },
            }
        })

    return {
        design: { ...design, links: [...design.links, ...newLinks], joints: [...design.joints, ...newJoints] },
        newRootId: idMap.get(linkId) as string,
    }
}

// ─── Validation & stats ────────────────────────────────────────

export function validateBody(design: AgentBodyDesign): string[] {
    const errors: string[] = []
    const linkIds = new Set(design.links.map((l) => l.id))
    if (design.links.length === 0) return ['Agent body phải có ít nhất 1 link.']
    if (!linkIds.has(design.rootLinkId)) errors.push('Root link không tồn tại.')

    const names = new Set<string>()
    for (const l of design.links) {
        if (names.has(l.name)) errors.push(`Tên link '${l.name}' bị trùng (URDF yêu cầu tên duy nhất).`)
        names.add(l.name)
        if (!(l.mass > 0)) errors.push(`Link '${l.name}' phải có khối lượng > 0.`)
    }
    const jointNames = new Set<string>()
    const parentOf = new Map<string, string>()
    for (const j of design.joints) {
        if (jointNames.has(j.name)) errors.push(`Tên joint '${j.name}' bị trùng.`)
        jointNames.add(j.name)
        if (!linkIds.has(j.parentLinkId) || !linkIds.has(j.childLinkId))
            errors.push(`Joint '${j.name}' tham chiếu link không tồn tại.`)
        if (parentOf.has(j.childLinkId)) errors.push(`Link con của '${j.name}' có nhiều joint cha.`)
        parentOf.set(j.childLinkId, j.parentLinkId)
        if ((j.type === 'revolute' || j.type === 'prismatic') && j.limit.lower > j.limit.upper)
            errors.push(`Joint '${j.name}': giới hạn dưới lớn hơn giới hạn trên.`)
        const [ax, ay, az] = j.axis
        if (j.type !== 'fixed' && Math.hypot(ax, ay, az) < 1e-6) errors.push(`Joint '${j.name}': trục bằng 0.`)
    }
    for (const l of design.links) {
        if (l.id !== design.rootLinkId && !parentOf.has(l.id)) errors.push(`Link '${l.name}' chưa nối vào cây.`)
    }
    return errors
}

export function computeStats(design: AgentBodyDesign): BodyStats {
    const movable = design.joints.filter((j) => j.type !== 'fixed')
    const actuated = movable.filter((j) => j.actuated)
    const contacts = design.links.filter((l) => l.isContactSensor).length
    return {
        linkCount: design.links.length,
        jointCount: design.joints.length,
        dof: movable.length,
        actionDim: actuated.length,
        observationDim: actuated.length * 2 + 13 + contacts,
        totalMass: round(
            design.links.reduce((s, l) => s + (Number(l.mass) || 0), 0),
            3
        ),
    }
}

export function jointRange(j: AgentJoint): [number, number] {
    if (j.type === 'continuous') return [-Math.PI, Math.PI]
    if (j.type === 'fixed') return [0, 0]
    return [j.limit.lower, j.limit.upper]
}

// ─── URDF export (Y-up -> Z-up qua base_footprint) ─────────────

const f4 = (n: number) => Number(n || 0).toFixed(4)
const v3 = (v: Vec3) => v.map(f4).join(' ')
const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_')

function hexToRgba(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
    if (!m) return '0.600 0.600 0.600 1.000'
    const n = parseInt(m[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1].map((x) => x.toFixed(3)).join(' ')
}

function geometryXml(l: AgentLink): string {
    const [a, b, c] = l.size
    if (l.shape === 'sphere') return `<sphere radius="${f4(a)}"/>`
    if (l.shape === 'cylinder' || l.shape === 'cone' || l.shape === 'gear' || l.shape === 'spring') {
        return `<cylinder radius="${f4(a)}" length="${f4(b)}"/>`
    }
    if (l.shape === 'torus') {
        const tube = l.shapeParams?.tubeRadius ?? a * 0.3
        return `<cylinder radius="${f4(a + tube)}" length="${f4(tube * 2)}"/>`
    }
    if (l.shape === 'capsule') return `<cylinder radius="${f4(a)}" length="${f4(b + 2 * a)}"/>`
    return `<box size="${f4(a)} ${f4(b)} ${f4(c)}"/>`
}

function inertiaXml(l: AgentLink): string {
    const m = Math.max(l.mass || 0.001, 0.001)
    const [a, b, c] = l.size
    let ixx: number, iyy: number, izz: number
    if (l.shape === 'sphere') {
        ixx = iyy = izz = 0.4 * m * a * a
    } else if (l.shape === 'cylinder' || l.shape === 'capsule' || l.shape === 'cone' || l.shape === 'gear' || l.shape === 'torus' || l.shape === 'spring') {
        ixx = iyy = (m * (3 * a * a + b * b)) / 12
        izz = 0.5 * m * a * a
    } else {
        ixx = (m * (b * b + c * c)) / 12
        iyy = (m * (a * a + c * c)) / 12
        izz = (m * (a * a + b * b)) / 12
    }
    const e = (x: number) => x.toExponential(4)
    return `<inertia ixx="${e(ixx)}" ixy="0" ixz="0" iyy="${e(iyy)}" iyz="0" izz="${e(izz)}"/>`
}

export function generateURDF(design: AgentBodyDesign): string {
    const byId = new Map(design.links.map((l) => [l.id, l]))
    const ln = (id: string) => safe(byId.get(id)?.name || id)
    const out: string[] = [
        '<?xml version="1.0"?>',
        `<robot name="${safe(design.name || 'agent_body')}">`,
        '  <!-- Generated by Agent Body Studio. Studio is Y-up; base_footprint rotates to Z-up. -->',
        '  <link name="base_footprint"/>',
        '  <joint name="base_footprint_to_root" type="fixed">',
        '    <parent link="base_footprint"/>',
        `    <child link="${ln(design.rootLinkId)}"/>`,
        `    <origin xyz="0 0 ${f4(design.spawnHeight)}" rpy="1.5708 0 0"/>`,
        '  </joint>',
    ]
    for (const l of design.links) {
        const rpy: Vec3 = [...l.visualRotation]
        if (l.shape === 'cylinder' || l.shape === 'capsule') rpy[0] += Math.PI / 2
        const origin = `<origin xyz="${v3(l.visualOffset)}" rpy="${v3(rpy)}"/>`
        out.push(
            `  <link name="${ln(l.id)}">`,
            '    <visual>',
            `      ${origin}`,
            `      <geometry>${geometryXml(l)}</geometry>`,
            `      <material name="mat_${safe(l.id)}"><color rgba="${hexToRgba(l.color)}"/></material>`,
            '    </visual>',
            '    <collision>',
            `      ${origin}`,
            `      <geometry>${geometryXml(l)}</geometry>`,
            '    </collision>',
            '    <inertial>',
            `      <origin xyz="${v3(l.visualOffset)}" rpy="0 0 0"/>`,
            `      <mass value="${f4(Math.max(l.mass, 0.001))}"/>`,
            `      ${inertiaXml(l)}`,
            '    </inertial>',
            '  </link>'
        )
    }
    for (const j of design.joints) {
        out.push(
            `  <joint name="${safe(j.name)}" type="${j.type}">`,
            `    <parent link="${ln(j.parentLinkId)}"/>`,
            `    <child link="${ln(j.childLinkId)}"/>`,
            `    <origin xyz="${v3(j.origin)}" rpy="${v3(j.originRotation)}"/>`
        )
        if (j.type !== 'fixed') {
            out.push(`    <axis xyz="${v3(j.axis)}"/>`)
            out.push(
                j.type === 'continuous'
                    ? `    <limit effort="${f4(j.limit.effort)}" velocity="${f4(j.limit.velocity)}"/>`
                    : `    <limit lower="${f4(j.limit.lower)}" upper="${f4(j.limit.upper)}" effort="${f4(j.limit.effort)}" velocity="${f4(j.limit.velocity)}"/>`
            )
            out.push(`    <dynamics damping="${f4(j.damping)}" friction="${f4(j.friction)}"/>`)
        }
        out.push('  </joint>')
    }
    out.push('</robot>')
    return out.join('\n')
}

// ─── Templates ─────────────────────────────────────────────────

function buildQuadruped(): AgentBodyDesign {
    const torso = makeLink({ name: 'torso', shape: 'box', size: [0.8, 0.15, 0.4], color: '#76b900', mass: 8 })
    const links: AgentLink[] = [torso]
    const joints: AgentJoint[] = []
    const legs: [string, number, number][] = [
        ['front_left', 0.32, 0.22],
        ['front_right', 0.32, -0.22],
        ['rear_left', -0.32, 0.22],
        ['rear_right', -0.32, -0.22],
    ]
    for (const [side, x, z] of legs) {
        const thigh = makeLink({ name: `${side}_thigh`, shape: 'capsule', size: [0.04, 0.22, 0], color: '#3f3f46', mass: 0.8, visualOffset: [0, -0.15, 0] })
        const shin = makeLink({ name: `${side}_shin`, shape: 'capsule', size: [0.032, 0.22, 0], color: '#a1a1aa', mass: 0.4, visualOffset: [0, -0.142, 0], isContactSensor: true })
        links.push(thigh, shin)
        joints.push(
            makeJoint({ name: `${side}_hip`, parentLinkId: torso.id, childLinkId: thigh.id, origin: [x, -0.075, z], limit: { lower: -60 * DEG, upper: 60 * DEG, effort: 40, velocity: 8 } }),
            makeJoint({ name: `${side}_knee`, parentLinkId: thigh.id, childLinkId: shin.id, origin: [0, -0.3, 0], limit: { lower: -130 * DEG, upper: 0, effort: 30, velocity: 8 }, defaultPosition: -30 * DEG })
        )
    }
    return { name: 'Quadruped Walker', description: 'Robot 4 chân, 8 khớp actuated', category: 'quadruped', rootLinkId: torso.id, spawnHeight: 0.62, links, joints }
}

function buildBiped(): AgentBodyDesign {
    const pelvis = makeLink({ name: 'pelvis', shape: 'box', size: [0.2, 0.12, 0.3], color: '#3b82f6', mass: 4 })
    const torso = makeLink({ name: 'torso', shape: 'box', size: [0.22, 0.4, 0.34], color: '#60a5fa', mass: 8, visualOffset: [0, 0.2, 0] })
    const head = makeLink({ name: 'head', shape: 'sphere', size: [0.1, 0, 0], color: '#e4e4e7', mass: 1, visualOffset: [0, 0.1, 0] })
    const links: AgentLink[] = [pelvis, torso, head]
    const joints: AgentJoint[] = [
        makeJoint({ name: 'waist', parentLinkId: pelvis.id, childLinkId: torso.id, origin: [0, 0.06, 0], axis: [0, 1, 0], limit: { lower: -45 * DEG, upper: 45 * DEG, effort: 40, velocity: 4 } }),
        makeJoint({ name: 'neck', type: 'fixed', parentLinkId: torso.id, childLinkId: head.id, origin: [0, 0.4, 0], actuated: false }),
    ]
    for (const [side, z] of [['left', 0.1], ['right', -0.1]] as [string, number][]) {
        const hip = makeLink({ name: `${side}_hip_link`, shape: 'sphere', size: [0.05, 0, 0], color: '#27272a', mass: 0.5 })
        const thigh = makeLink({ name: `${side}_thigh`, shape: 'capsule', size: [0.05, 0.3, 0], color: '#3f3f46', mass: 2, visualOffset: [0, -0.2, 0] })
        const shin = makeLink({ name: `${side}_shin`, shape: 'capsule', size: [0.045, 0.3, 0], color: '#71717a', mass: 1.5, visualOffset: [0, -0.195, 0] })
        const foot = makeLink({ name: `${side}_foot`, shape: 'box', size: [0.22, 0.05, 0.1], color: '#18181b', mass: 0.6, visualOffset: [0.04, -0.025, 0], isContactSensor: true })
        links.push(hip, thigh, shin, foot)
        joints.push(
            makeJoint({ name: `${side}_hip_roll`, parentLinkId: pelvis.id, childLinkId: hip.id, origin: [0, -0.06, z], axis: [1, 0, 0], limit: { lower: -30 * DEG, upper: 30 * DEG, effort: 60, velocity: 6 } }),
            makeJoint({ name: `${side}_hip_pitch`, parentLinkId: hip.id, childLinkId: thigh.id, origin: [0, 0, 0], limit: { lower: -90 * DEG, upper: 60 * DEG, effort: 80, velocity: 6 } }),
            makeJoint({ name: `${side}_knee`, parentLinkId: thigh.id, childLinkId: shin.id, origin: [0, -0.4, 0], limit: { lower: -140 * DEG, upper: 0, effort: 80, velocity: 6 } }),
            makeJoint({ name: `${side}_ankle`, parentLinkId: shin.id, childLinkId: foot.id, origin: [0, -0.39, 0], limit: { lower: -45 * DEG, upper: 45 * DEG, effort: 40, velocity: 6 } })
        )
        const upperArm = makeLink({ name: `${side}_upper_arm`, shape: 'capsule', size: [0.035, 0.22, 0], color: '#93c5fd', mass: 1, visualOffset: [0, -0.145, 0] })
        const forearm = makeLink({ name: `${side}_forearm`, shape: 'capsule', size: [0.03, 0.2, 0], color: '#bfdbfe', mass: 0.6, visualOffset: [0, -0.13, 0] })
        links.push(upperArm, forearm)
        joints.push(
            makeJoint({ name: `${side}_shoulder`, parentLinkId: torso.id, childLinkId: upperArm.id, origin: [0, 0.36, z * 2.1], limit: { lower: -120 * DEG, upper: 120 * DEG, effort: 30, velocity: 6 } }),
            makeJoint({ name: `${side}_elbow`, parentLinkId: upperArm.id, childLinkId: forearm.id, origin: [0, -0.29, 0], limit: { lower: 0, upper: 140 * DEG, effort: 20, velocity: 6 } })
        )
    }
    return { name: 'Biped Humanoid', description: 'Robot 2 chân dạng người, 13 khớp actuated', category: 'humanoid', rootLinkId: pelvis.id, spawnHeight: 0.9, links, joints }
}

function buildRobotArm(): AgentBodyDesign {
    const base = makeLink({ name: 'base', shape: 'cylinder', size: [0.15, 0.08, 0], color: '#27272a', mass: 5, visualOffset: [0, 0.04, 0] })
    const turret = makeLink({ name: 'turret', shape: 'cylinder', size: [0.1, 0.12, 0], color: '#f59e0b', mass: 1.5, visualOffset: [0, 0.06, 0] })
    const upper = makeLink({ name: 'upper_arm', shape: 'box', size: [0.08, 0.4, 0.08], color: '#fbbf24', mass: 1.2, visualOffset: [0, 0.2, 0] })
    const fore = makeLink({ name: 'forearm', shape: 'box', size: [0.07, 0.35, 0.07], color: '#fcd34d', mass: 0.8, visualOffset: [0, 0.175, 0] })
    const wrist = makeLink({ name: 'wrist', shape: 'sphere', size: [0.045, 0, 0], color: '#3f3f46', mass: 0.3 })
    const palm = makeLink({ name: 'palm', shape: 'box', size: [0.12, 0.04, 0.06], color: '#52525b', mass: 0.2, visualOffset: [0, 0.04, 0] })
    const fl = makeLink({ name: 'finger_left', shape: 'box', size: [0.015, 0.08, 0.04], color: '#a1a1aa', mass: 0.05, visualOffset: [0, 0.04, 0], isContactSensor: true })
    const fr = makeLink({ name: 'finger_right', shape: 'box', size: [0.015, 0.08, 0.04], color: '#a1a1aa', mass: 0.05, visualOffset: [0, 0.04, 0], isContactSensor: true })
    return {
        name: 'Robot Arm 6-DOF',
        description: 'Cánh tay robot cố định với gripper 2 ngón',
        category: 'manipulator',
        rootLinkId: base.id,
        spawnHeight: 0,
        links: [base, turret, upper, fore, wrist, palm, fl, fr],
        joints: [
            makeJoint({ name: 'base_yaw', parentLinkId: base.id, childLinkId: turret.id, origin: [0, 0.08, 0], axis: [0, 1, 0], limit: { lower: -170 * DEG, upper: 170 * DEG, effort: 50, velocity: 3 } }),
            makeJoint({ name: 'shoulder', parentLinkId: turret.id, childLinkId: upper.id, origin: [0, 0.12, 0], limit: { lower: -100 * DEG, upper: 100 * DEG, effort: 50, velocity: 3 } }),
            makeJoint({ name: 'elbow', parentLinkId: upper.id, childLinkId: fore.id, origin: [0, 0.4, 0], limit: { lower: -140 * DEG, upper: 140 * DEG, effort: 30, velocity: 3 } }),
            makeJoint({ name: 'wrist_pitch', parentLinkId: fore.id, childLinkId: wrist.id, origin: [0, 0.35, 0], limit: { lower: -100 * DEG, upper: 100 * DEG, effort: 10, velocity: 4 } }),
            makeJoint({ name: 'wrist_roll', parentLinkId: wrist.id, childLinkId: palm.id, origin: [0, 0.02, 0], axis: [0, 1, 0], type: 'continuous', limit: { lower: -Math.PI, upper: Math.PI, effort: 5, velocity: 6 } }),
            makeJoint({ name: 'finger_left_slide', type: 'prismatic', parentLinkId: palm.id, childLinkId: fl.id, origin: [0.03, 0.06, 0], axis: [1, 0, 0], limit: { lower: -0.02, upper: 0.02, effort: 5, velocity: 0.2 } }),
            makeJoint({ name: 'finger_right_slide', type: 'prismatic', parentLinkId: palm.id, childLinkId: fr.id, origin: [-0.03, 0.06, 0], axis: [-1, 0, 0], limit: { lower: -0.02, upper: 0.02, effort: 5, velocity: 0.2 } }),
        ],
    }
}

function buildRover(): AgentBodyDesign {
    const chassis = makeLink({ name: 'chassis', shape: 'box', size: [0.5, 0.12, 0.32], color: '#f97316', mass: 4 })
    const lw = makeLink({ name: 'left_wheel', shape: 'cylinder', size: [0.1, 0.05, 0], color: '#18181b', mass: 0.5, visualRotation: [90 * DEG, 0, 0], isContactSensor: true })
    const rw = makeLink({ name: 'right_wheel', shape: 'cylinder', size: [0.1, 0.05, 0], color: '#18181b', mass: 0.5, visualRotation: [90 * DEG, 0, 0], isContactSensor: true })
    const caster = makeLink({ name: 'caster', shape: 'sphere', size: [0.04, 0, 0], color: '#71717a', mass: 0.1, isContactSensor: true })
    const lidar = makeLink({ name: 'lidar', shape: 'cylinder', size: [0.05, 0.05, 0], color: '#22d3ee', mass: 0.2, visualOffset: [0, 0.025, 0] })
    const wheel = (name: string, child: string, z: number) =>
        makeJoint({ name, type: 'continuous', parentLinkId: chassis.id, childLinkId: child, origin: [0.1, -0.04, z], axis: [0, 0, 1], limit: { lower: -Math.PI, upper: Math.PI, effort: 10, velocity: 20 } })
    return {
        name: 'Differential Rover',
        description: 'Xe 2 bánh vi sai + caster, phù hợp bài toán navigation',
        category: 'wheeled',
        rootLinkId: chassis.id,
        spawnHeight: 0.15,
        links: [chassis, lw, rw, caster, lidar],
        joints: [
            wheel('left_wheel_joint', lw.id, 0.19),
            wheel('right_wheel_joint', rw.id, -0.19),
            makeJoint({ name: 'caster_mount', type: 'fixed', parentLinkId: chassis.id, childLinkId: caster.id, origin: [-0.2, -0.1, 0], actuated: false }),
            makeJoint({ name: 'lidar_mount', type: 'fixed', parentLinkId: chassis.id, childLinkId: lidar.id, origin: [0.12, 0.06, 0], actuated: false }),
        ],
    }
}

function buildSnake(): AgentBodyDesign {
    const segs: AgentLink[] = []
    const joints: AgentJoint[] = []
    for (let i = 0; i < 7; i++) {
        const seg = makeLink({
            name: i === 0 ? 'head' : `segment_${i}`,
            shape: 'capsule',
            size: [0.05, 0.14, 0],
            color: i % 2 === 0 ? '#10b981' : '#34d399',
            mass: 0.4,
            visualOffset: [-0.12, 0, 0],
            visualRotation: [0, 0, 90 * DEG],
            isContactSensor: true,
        })
        segs.push(seg)
        if (i > 0) {
            joints.push(
                makeJoint({
                    name: `joint_${i}_${i % 2 === 0 ? 'pitch' : 'yaw'}`,
                    parentLinkId: segs[i - 1].id,
                    childLinkId: seg.id,
                    origin: [-0.25, 0, 0],
                    axis: i % 2 === 0 ? [0, 0, 1] : [0, 1, 0],
                    limit: { lower: -60 * DEG, upper: 60 * DEG, effort: 10, velocity: 5 },
                })
            )
        }
    }
    return { name: 'Snake Robot', description: 'Rắn 7 đốt, khớp yaw/pitch xen kẽ', category: 'modular', rootLinkId: segs[0].id, spawnHeight: 0.06, links: segs, joints }
}

function buildEmpty(): AgentBodyDesign {
    const base = makeLink({ name: 'base_link', shape: 'box', size: [0.4, 0.15, 0.3], color: '#76b900', mass: 3 })
    return { name: 'Agent Body Mới', description: '', category: 'custom', rootLinkId: base.id, spawnHeight: 0.4, links: [base], joints: [] }
}

export const BODY_TEMPLATES: Record<string, { label: string; build: () => AgentBodyDesign }> = {
    quadruped: { label: 'Quadruped (4 chân)', build: buildQuadruped },
    biped: { label: 'Biped Humanoid (2 chân)', build: buildBiped },
    arm: { label: 'Robot Arm + Gripper', build: buildRobotArm },
    rover: { label: 'Differential Rover (bánh xe)', build: buildRover },
    snake: { label: 'Snake Robot (đốt nối)', build: buildSnake },
    empty: { label: 'Thân trống', build: buildEmpty },
}

