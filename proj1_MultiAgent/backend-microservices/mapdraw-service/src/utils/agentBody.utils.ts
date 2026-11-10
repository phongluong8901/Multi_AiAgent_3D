import { IAgentJoint, IAgentLink } from "../models/agentBody.model";

export interface AgentBodyPayload {
    name: string;
    rootLinkId: string;
    spawnHeight?: number;
    links: IAgentLink[];
    joints: IAgentJoint[];
}

/**
 * Kiểm tra cấu trúc kinematic tree hợp lệ:
 * - Có đúng 1 root link, root không phải là con của joint nào
 * - Mỗi link (trừ root) có đúng 1 joint cha
 * - Joint tham chiếu tới link tồn tại, không có chu trình
 */
export function validateKinematicTree(body: AgentBodyPayload): string[] {
    const errors: string[] = [];
    const linkIds = new Set(body.links.map((l) => l.id));

    if (body.links.length === 0) {
        errors.push("Agent body phải có ít nhất 1 link.");
        return errors;
    }
    if (linkIds.size !== body.links.length) errors.push("Có link bị trùng id.");
    if (!linkIds.has(body.rootLinkId)) errors.push(`rootLinkId '${body.rootLinkId}' không tồn tại.`);

    const jointIds = new Set<string>();
    const parentOf = new Map<string, string>();

    const linkNames = new Set<string>();
    for (const l of body.links) {
        if (linkNames.has(l.name)) errors.push(`Tên link '${l.name}' bị trùng (URDF yêu cầu tên duy nhất).`);
        linkNames.add(l.name);
    }
    const jointNames = new Set<string>();

    for (const j of body.joints) {
        if (jointNames.has(j.name)) errors.push(`Tên joint '${j.name}' bị trùng.`);
        jointNames.add(j.name);
        if (jointIds.has(j.id)) errors.push(`Joint id '${j.id}' bị trùng.`);
        jointIds.add(j.id);
        if (!linkIds.has(j.parentLinkId)) errors.push(`Joint '${j.name}': parent link không tồn tại.`);
        if (!linkIds.has(j.childLinkId)) errors.push(`Joint '${j.name}': child link không tồn tại.`);
        if (j.childLinkId === body.rootLinkId) errors.push(`Joint '${j.name}': root link không được là link con.`);
        if (parentOf.has(j.childLinkId)) errors.push(`Link '${j.childLinkId}' có nhiều hơn 1 joint cha.`);
        parentOf.set(j.childLinkId, j.parentLinkId);
        if (j.type === "revolute" || j.type === "prismatic") {
            if (j.limit && j.limit.lower > j.limit.upper) errors.push(`Joint '${j.name}': limit.lower > limit.upper.`);
        }
    }

    for (const l of body.links) {
        if (l.id !== body.rootLinkId && !parentOf.has(l.id)) {
            errors.push(`Link '${l.name}' không được nối vào cây (thiếu joint cha).`);
        }
    }

    // Phát hiện chu trình
    for (const start of parentOf.keys()) {
        const seen = new Set<string>();
        let cur: string | undefined = start;
        while (cur && parentOf.has(cur)) {
            if (seen.has(cur)) {
                errors.push(`Phát hiện chu trình tại link '${start}'.`);
                break;
            }
            seen.add(cur);
            cur = parentOf.get(cur);
        }
    }

    return errors;
}

/** Thống kê dùng cho RL: số bậc tự do, kích thước action / observation space */
export function computeBodyStats(body: AgentBodyPayload) {
    const actuated = body.joints.filter((j) => j.actuated && j.type !== "fixed");
    const totalMass = body.links.reduce((s, l) => s + (Number(l.mass) || 0), 0);
    const contactSensors = body.links.filter((l) => l.isContactSensor).length;
    return {
        linkCount: body.links.length,
        jointCount: body.joints.length,
        dof: body.joints.filter((j) => j.type !== "fixed").length,
        actionDim: actuated.length,
        // pos + vel mỗi joint actuated + base (pos 3, quat 4, linvel 3, angvel 3) + contacts
        observationDim: actuated.length * 2 + 13 + contactSensors,
        totalMass: Number(totalMass.toFixed(3)),
        actuatedJoints: actuated.map((j) => ({
            name: j.name,
            type: j.type,
            lower: j.type === "continuous" ? -Math.PI : j.limit?.lower,
            upper: j.type === "continuous" ? Math.PI : j.limit?.upper,
            effort: j.limit?.effort,
            velocity: j.limit?.velocity,
        })),
    };
}

const f = (n: number) => Number(n || 0).toFixed(4);
const v3 = (v: number[] | undefined) => (v || [0, 0, 0]).map(f).join(" ");
const esc = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, "_");

function geometryXml(l: IAgentLink): string {
    const [a, b, c] = l.size;
    switch (l.shape) {
        case "sphere":
            return `<sphere radius="${f(a)}"/>`;
        case "cylinder":
        case "cone":
        case "gear":
        case "spring":
            // URDF cylinder dọc theo trục Z, studio dùng trục Y -> xoay 90 độ quanh X trong origin
            return `<cylinder radius="${f(a)}" length="${f(b)}"/>`;
        case "torus":
            const tube = Number(l.shapeParams?.tubeRadius) || (a * 0.3);
            return `<cylinder radius="${f(a + tube)}" length="${f(tube * 2)}"/>`;
        case "capsule":
            // URDF chuẩn không có capsule -> xấp xỉ bằng cylinder có chiều dài tổng (thân + 2 bán cầu)
            return `<cylinder radius="${f(a)}" length="${f(b + 2 * a)}"/>`;
        case "wedge":
        case "extrusion":
        default:
            return `<box size="${f(a)} ${f(b)} ${f(c)}"/>`;
    }
}

function inertiaXml(l: IAgentLink): string {
    const m = Math.max(Number(l.mass) || 0.001, 0.001);
    const [a, b, c] = l.size;
    let ixx: number, iyy: number, izz: number;
    if (l.shape === "sphere") {
        ixx = iyy = izz = (2 / 5) * m * a * a;
    } else if (l.shape === "cylinder" || l.shape === "capsule" || l.shape === "cone" || l.shape === "gear" || l.shape === "torus" || l.shape === "spring") {
        // Trục dọc là Z sau khi xoay tương thích URDF
        ixx = iyy = (1 / 12) * m * (3 * a * a + b * b);
        izz = 0.5 * m * a * a;
    } else {
        ixx = (1 / 12) * m * (b * b + c * c);
        iyy = (1 / 12) * m * (a * a + c * c);
        izz = (1 / 12) * m * (a * a + b * b);
    }
    return `<inertia ixx="${ixx.toExponential(4)}" ixy="0" ixz="0" iyy="${iyy.toExponential(4)}" iyz="0" izz="${izz.toExponential(4)}"/>`;
}

/**
 * Xuất URDF chuẩn (dùng được cho PyBullet, MuJoCo, Isaac Sim, Gazebo).
 * Lưu ý: Studio dùng hệ trục Y-up (three.js), URDF dùng Z-up.
 * Ta thêm một link gốc `base_footprint` xoay +90 độ quanh X để chuyển hệ trục.
 */
export function generateURDF(body: AgentBodyPayload): string {
    const linkById = new Map(body.links.map((l) => [l.id, l]));
    const name = (id: string) => esc(linkById.get(id)?.name || id);
    const lines: string[] = [];
    lines.push(`<?xml version="1.0"?>`);
    lines.push(`<robot name="${esc(body.name)}">`);
    lines.push(`  <!-- Generated by Agent Body Studio (mapdraw-service). Y-up -> Z-up via base_footprint. -->`);
    lines.push(`  <link name="base_footprint"/>`);
    lines.push(`  <joint name="base_footprint_to_root" type="fixed">`);
    lines.push(`    <parent link="base_footprint"/>`);
    lines.push(`    <child link="${name(body.rootLinkId)}"/>`);
    lines.push(`    <origin xyz="0 0 ${f(body.spawnHeight ?? 0.5)}" rpy="1.5708 0 0"/>`);
    lines.push(`  </joint>`);

    for (const l of body.links) {
        const isCyl = l.shape === "cylinder" || l.shape === "capsule";
        const rpy = [...(l.visualRotation || [0, 0, 0])];
        if (isCyl) rpy[0] = (rpy[0] || 0) + Math.PI / 2;
        const origin = `<origin xyz="${v3(l.visualOffset)}" rpy="${v3(rpy)}"/>`;
        lines.push(`  <link name="${name(l.id)}">`);
        lines.push(`    <visual>`);
        lines.push(`      ${origin}`);
        lines.push(`      <geometry>${geometryXml(l)}</geometry>`);
        lines.push(`      <material name="mat_${esc(l.id)}"><color rgba="${hexToRgba(l.color)}"/></material>`);
        lines.push(`    </visual>`);
        lines.push(`    <collision>`);
        lines.push(`      ${origin}`);
        lines.push(`      <geometry>${geometryXml(l)}</geometry>`);
        lines.push(`    </collision>`);
        lines.push(`    <inertial>`);
        lines.push(`      <origin xyz="${v3(l.visualOffset)}" rpy="0 0 0"/>`);
        lines.push(`      <mass value="${f(Math.max(l.mass, 0.001))}"/>`);
        lines.push(`      ${inertiaXml(l)}`);
        lines.push(`    </inertial>`);
        lines.push(`  </link>`);
    }

    for (const j of body.joints) {
        lines.push(`  <joint name="${esc(j.name)}" type="${j.type}">`);
        lines.push(`    <parent link="${name(j.parentLinkId)}"/>`);
        lines.push(`    <child link="${name(j.childLinkId)}"/>`);
        lines.push(`    <origin xyz="${v3(j.origin)}" rpy="${v3(j.originRotation)}"/>`);
        if (j.type !== "fixed") {
            lines.push(`    <axis xyz="${v3(j.axis)}"/>`);
            const lim = j.limit || { lower: 0, upper: 0, effort: 10, velocity: 5 };
            if (j.type === "continuous") {
                lines.push(`    <limit effort="${f(lim.effort)}" velocity="${f(lim.velocity)}"/>`);
            } else {
                lines.push(
                    `    <limit lower="${f(lim.lower)}" upper="${f(lim.upper)}" effort="${f(lim.effort)}" velocity="${f(lim.velocity)}"/>`
                );
            }
            lines.push(`    <dynamics damping="${f(j.damping)}" friction="${f(j.friction)}"/>`);
        }
        lines.push(`  </joint>`);
    }

    lines.push(`</robot>`);
    return lines.join("\n");
}

function hexToRgba(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "0.6 0.6 0.6 1";
    const n = parseInt(m[1], 16);
    return `${((n >> 16) & 255) / 255} ${((n >> 8) & 255) / 255} ${(n & 255) / 255} 1`
        .split(" ")
        .map((x) => Number(x).toFixed(3))
        .join(" ");
}
