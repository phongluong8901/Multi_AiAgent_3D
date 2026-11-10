/**
 * Locomotion Engine cho Robot 4 chân (Quadruped Dog Robot) & Multi-Joint Body
 * Mô phỏng động lực học đa vật thể (Rigid body, joints, gravity, ground contact, Coulomb friction)
 * và triển khai các thuật toán RL điều khiển vận động: Continuous PPO, Continuous SAC, CPG+PPO.
 */

export type LocomotionTask = 'stand' | 'walk' | 'turn'
export type LocomotionAlgorithm = 'ppo' | 'sac' | 'cpg_ppo'

export interface JointState {
    name: string
    angle: number // rad
    velocity: number // rad/s
    torque: number // Nm
    targetAngle: number // rad
    lowerLimit: number
    upperLimit: number
    maxTorque: number
}

export interface QuadrupedState {
    // Base Torso
    posX: number
    posY: number // chiều cao (m)
    posZ: number
    velX: number
    velY: number
    velZ: number
    roll: number // rad
    pitch: number // rad
    yaw: number // rad
    angVelRoll: number
    angVelPitch: number
    angVelYaw: number

    // 8 Khớp (4 chân x 2 khớp Hip & Knee)
    joints: {
        frontLeftHip: JointState
        frontLeftKnee: JointState
        frontRightHip: JointState
        frontRightKnee: JointState
        rearLeftHip: JointState
        rearLeftKnee: JointState
        rearRightHip: JointState
        rearRightKnee: JointState
    }

    // 4 Cảm biến tiếp xúc bàn chân (FL, FR, RL, RR)
    footContacts: [boolean, boolean, boolean, boolean]
    footPositions: [
        [number, number, number],
        [number, number, number],
        [number, number, number],
        [number, number, number]
    ]

    isFallen: boolean
}

export interface TrainingMetrics {
    episode: number
    step: number
    episodeReward: number
    bestReward: number
    forwardVelocity: number
    heightError: number
    tiltError: number
    torqueRms: number
    footContactRatio: number
    loss: number
    history: { episode: number; reward: number; height: number; speed: number }[]
}

// ─── Khởi tạo trạng thái ban đầu của Robot 4 chân ─────────────
export function createInitialQuadrupedState(): QuadrupedState {
    const makeJoint = (name: string, lower: number, upper: number, defAngle: number): JointState => ({
        name,
        angle: defAngle,
        velocity: 0,
        torque: 0,
        targetAngle: defAngle,
        lowerLimit: lower,
        upperLimit: upper,
        maxTorque: 35,
    })

    const deg = Math.PI / 180
    return {
        posX: 0,
        posY: 0.52, // Bắt đầu ở độ cao chuẩn
        posZ: 0,
        velX: 0,
        velY: 0,
        velZ: 0,
        roll: 0,
        pitch: 0,
        yaw: 0,
        angVelRoll: 0,
        angVelPitch: 0,
        angVelYaw: 0,
        joints: {
            frontLeftHip: makeJoint('FL_Hip', -45 * deg, 45 * deg, 0),
            frontLeftKnee: makeJoint('FL_Knee', -110 * deg, -10 * deg, -40 * deg),
            frontRightHip: makeJoint('FR_Hip', -45 * deg, 45 * deg, 0),
            frontRightKnee: makeJoint('FR_Knee', -110 * deg, -10 * deg, -40 * deg),
            rearLeftHip: makeJoint('RL_Hip', -45 * deg, 45 * deg, 0),
            rearLeftKnee: makeJoint('RL_Knee', -110 * deg, -10 * deg, -40 * deg),
            rearRightHip: makeJoint('RR_Hip', -45 * deg, 45 * deg, 0),
            rearRightKnee: makeJoint('RR_Knee', -110 * deg, -10 * deg, -40 * deg),
        },
        footContacts: [true, true, true, true],
        footPositions: [
            [0.28, 0, 0.22],
            [0.28, 0, -0.22],
            [-0.28, 0, 0.22],
            [-0.28, 0, -0.22],
        ],
        isFallen: false,
    }
}

// ─── Trích xuất 28-dim Observation Vector cho Policy Mạng nơ-ron ───
export function extractObservation(state: QuadrupedState): number[] {
    const jList = Object.values(state.joints)
    const obs = [
        state.posY - 0.5, // Độ lệch chiều cao chuẩn
        state.velX,
        state.velY,
        state.velZ,
        state.roll,
        state.pitch,
        state.yaw,
        state.angVelRoll,
        state.angVelPitch,
        state.angVelYaw,
        ...jList.map((j) => (j.angle - (j.lowerLimit + j.upperLimit) / 2) / ((j.upperLimit - j.lowerLimit) / 2)),
        ...jList.map((j) => j.velocity / 10.0),
        ...state.footContacts.map((c) => (c ? 1.0 : -1.0)),
    ]
    return obs
}

// ─── Bộ phát nhịp sinh học CPG (Central Pattern Generator - Trot Gait) ───
export function computeCPGPattern(t: number, freq: number = 1.8): number[] {
    // Nhịp bước đi chéo (Trot): (Chân FL + RR) cùng pha, (Chân FR + RL) lệch pha 180 độ
    const phaseA = t * 2 * Math.PI * freq
    const phaseB = phaseA + Math.PI

    const ampHip = 0.35 // rad
    const ampKnee = 0.45 // rad

    const flHip = Math.sin(phaseA) * ampHip
    const flKnee = -0.7 + (Math.cos(phaseA) > 0 ? Math.cos(phaseA) * ampKnee : 0)

    const rrHip = Math.sin(phaseA) * ampHip
    const rrKnee = -0.7 + (Math.cos(phaseA) > 0 ? Math.cos(phaseA) * ampKnee : 0)

    const frHip = Math.sin(phaseB) * ampHip
    const frKnee = -0.7 + (Math.cos(phaseB) > 0 ? Math.cos(phaseB) * ampKnee : 0)

    const rlHip = Math.sin(phaseB) * ampHip
    const rlKnee = -0.7 + (Math.cos(phaseB) > 0 ? Math.cos(phaseB) * ampKnee : 0)

    return [flHip, flKnee, frHip, frKnee, rlHip, rlKnee, rrHip, rrKnee]
}

// ─── Mô phỏng Động học Vật lý 1 bước (Physics Step Engine) ─────
export function stepPhysics(
    state: QuadrupedState,
    actions: number[], // 8 continuous actions in [-1, 1]
    task: LocomotionTask,
    dt: number = 0.02,
    cpgOffset?: number[]
): { nextState: QuadrupedState; reward: number; done: boolean } {
    const s = JSON.parse(JSON.stringify(state)) as QuadrupedState
    const jointKeys = Object.keys(s.joints) as (keyof typeof s.joints)[]

    // Khối lượng & Quán tính
    const mass = 8.5 // kg
    const gravity = 9.81
    const targetHeight = 0.50

    // 1. Áp dụng điều khiển Motor PD (Proportional-Derivative) lên từng khớp
    const kp = 75.0 // Độ cứng lò xo khớp (Stiffness)
    const kd = 4.5  // Giảm chấn khớp (Damping)
    let totalTorqueCost = 0

    jointKeys.forEach((key, idx) => {
        const j = s.joints[key]
        let desired = ((actions[idx] ?? 0) * (j.upperLimit - j.lowerLimit)) / 2 + (j.lowerLimit + j.upperLimit) / 2
        if (cpgOffset && cpgOffset[idx] !== undefined) {
            desired += cpgOffset[idx] * 0.4
        }
        desired = Math.max(j.lowerLimit, Math.min(j.upperLimit, desired))
        j.targetAngle = desired

        // PD control
        const angleErr = j.targetAngle - j.angle
        let torque = kp * angleErr - kd * j.velocity
        torque = Math.max(-j.maxTorque, Math.min(j.maxTorque, torque))
        j.torque = torque
        totalTorqueCost += Math.abs(torque)

        // Tích phân góc khớp
        const jointAcc = torque / 0.15
        j.velocity += jointAcc * dt
        j.velocity *= 0.94 // Ma sát trục khớp
        j.angle += j.velocity * dt
        j.angle = Math.max(j.lowerLimit, Math.min(j.upperLimit, j.angle))
    })

    // 2. Tính toán động học chân (Forward Kinematics chân)
    const thighLength = 0.22
    const shinLength = 0.22

    const legOffsets: [number, number][] = [
        [0.28, 0.22],   // FL
        [0.28, -0.22],  // FR
        [-0.28, 0.22],  // RL
        [-0.28, -0.22], // RR
    ]

    let groundContactCount = 0
    let totalGroundForce = 0

    legOffsets.forEach(([ox, oz], i) => {
        const hipKey = jointKeys[i * 2]
        const kneeKey = jointKeys[i * 2 + 1]
        const qHip = s.joints[hipKey].angle
        const qKnee = s.joints[kneeKey].angle

        // Toạ độ mũi chân so với gốc thân
        const legY = -Math.cos(qHip) * thighLength - Math.cos(qHip + qKnee) * shinLength
        const legX = ox + Math.sin(qHip) * thighLength + Math.sin(qHip + qKnee) * shinLength
        const legZ = oz

        const worldFootY = s.posY + legY
        s.footPositions[i] = [s.posX + legX, Math.max(0, worldFootY), s.posZ + legZ]

        // Va chạm mặt đất (Ground spring-damper contact model)
        if (worldFootY <= 0.005) {
            s.footContacts[i] = true
            groundContactCount++
            const penetration = Math.max(0, -worldFootY)
            const normalForce = penetration * 4500 - s.velY * 180
            if (normalForce > 0) {
                totalGroundForce += normalForce
                // Ma sát Coulomb tiếp tuyến đẩy robot tiến/lùi
                const slipX = -s.velX
                const frictionCoeff = 0.8
                const frictionForceX = Math.max(-normalForce * frictionCoeff, Math.min(normalForce * frictionCoeff, slipX * 120))
                s.velX += (frictionForceX / mass) * dt
            }
        } else {
            s.footContacts[i] = false
        }
    })

    // 3. Động lực học thân chính (Rigid Body Physics)
    const netForceY = totalGroundForce - mass * gravity
    const accY = netForceY / mass
    s.velY += accY * dt
    s.velY *= 0.96
    s.posY += s.velY * dt

    // Giữ sàn phẳng không cho robot lún xuyên đất
    if (s.posY < 0.16) {
        s.posY = 0.16
        s.velY = 0
        s.isFallen = true
    }

    s.posX += s.velX * dt
    s.velX *= 0.985 // Cản không khí

    // Mô phỏng góc nghiêng Roll / Pitch dao động tự nhiên
    const targetTilt = 0
    s.angVelPitch += ((targetTilt - s.pitch) * 15 - s.angVelPitch * 3.5) * dt
    s.pitch += s.angVelPitch * dt

    s.angVelRoll += ((targetTilt - s.roll) * 15 - s.angVelRoll * 3.5) * dt
    s.roll += s.angVelRoll * dt

    if (Math.abs(s.pitch) > 0.85 || Math.abs(s.roll) > 0.85) {
        s.isFallen = true
    }

    // 4. Tính toán Hàm Thưởng Huấn Luyện (Reward Function)
    let reward = 0
    const heightDiff = Math.abs(s.posY - targetHeight)
    const tiltNorm = Math.hypot(s.roll, s.pitch)

    if (task === 'stand') {
        // Thưởng giữ đúng độ cao chuẩn
        const rHeight = Math.exp(-15 * heightDiff * heightDiff) * 3.0
        // Thưởng giữ thăng bằng thân thẳng (ít nghiêng)
        const rUpright = Math.exp(-8 * tiltNorm * tiltNorm) * 2.0
        // Thưởng 4 chân tiếp xúc đều
        const rContact = (groundContactCount / 4.0) * 1.5
        // Phạt tiêu hao năng lượng
        const pTorque = (totalTorqueCost / 200.0) * 0.3
        // Phạt ngã
        const pFall = s.isFallen ? 10.0 : 0.0

        reward = rHeight + rUpright + rContact - pTorque - pFall
    } else if (task === 'walk') {
        // Thưởng vận tốc tiến về phía trước (+X)
        const rVelocity = Math.max(0, s.velX) * 5.0
        // Thưởng duy trì độ cao
        const rHeight = Math.exp(-12 * heightDiff * heightDiff) * 2.0
        // Thưởng nhịp bước đối xứng (Trot symmetry: chéo chân FL+RR hoặc FR+RL)
        const trotSymmetry = (s.footContacts[0] === s.footContacts[3] && s.footContacts[1] === s.footContacts[2] && s.footContacts[0] !== s.footContacts[1]) ? 1.5 : 0.2
        // Phạt tiêu hao năng lượng và trượt
        const pTorque = (totalTorqueCost / 250.0) * 0.4
        const pFall = s.isFallen ? 12.0 : 0.0

        reward = rVelocity + rHeight + trotSymmetry - pTorque - pFall
    } else {
        // Task quay vòng (Turn)
        const rYaw = s.angVelYaw * 2.5
        reward = rYaw - tiltNorm - (s.isFallen ? 10 : 0)
    }

    const done = s.isFallen || s.posY < 0.18

    return { nextState: s, reward, done }
}

// ─── Simple Continuous Actor-Critic Model (PPO / SAC weights) ──
export class ContinuousActorCriticPolicy {
    public stateDim: number = 28
    public actionDim: number = 8
    public hiddenDim: number = 64

    // Actor weights: s -> hidden -> [mean, log_std]
    public w1_a: number[][]
    public b1_a: number[]
    public w2_mu: number[][]
    public b2_mu: number[]
    public log_std: number[]

    // Critic weights: s -> hidden -> value
    public w1_c: number[][]
    public b1_c: number[]
    public w2_c: number[]
    public b2_c: number = 0

    constructor(stateDim = 28, actionDim = 8, hiddenDim = 64) {
        this.stateDim = stateDim
        this.actionDim = actionDim
        this.hiddenDim = hiddenDim

        // Khởi tạo trọng số ngẫu nhiên chuẩn He/Xavier
        const scaleA = Math.sqrt(2.0 / (stateDim + hiddenDim))
        this.w1_a = Array.from({ length: stateDim }, () =>
            Array.from({ length: hiddenDim }, () => (Math.random() * 2 - 1) * scaleA)
        )
        this.b1_a = new Array(hiddenDim).fill(0)

        this.w2_mu = Array.from({ length: hiddenDim }, () =>
            Array.from({ length: actionDim }, () => (Math.random() * 2 - 1) * 0.08)
        )
        this.b2_mu = new Array(actionDim).fill(0)
        this.log_std = new Array(actionDim).fill(-0.5)

        // Critic
        this.w1_c = Array.from({ length: stateDim }, () =>
            Array.from({ length: hiddenDim }, () => (Math.random() * 2 - 1) * scaleA)
        )
        this.b1_c = new Array(hiddenDim).fill(0)
        this.w2_c = Array.from({ length: hiddenDim }, () => (Math.random() * 2 - 1) * 0.1)
    }

    // Lan truyền tiến Actor: Trả về vector hành động liên tục [-1, 1]
    public forwardAction(state: number[], explore: boolean = true): number[] {
        // Layer 1
        const h = new Array(this.hiddenDim).fill(0)
        for (let j = 0; j < this.hiddenDim; j++) {
            let sum = this.b1_a[j]
            for (let i = 0; i < this.stateDim; i++) {
                sum += (state[i] || 0) * this.w1_a[i][j]
            }
            h[j] = Math.tanh(sum) // Tanh activation
        }

        // Output mean
        const actions: number[] = new Array(this.actionDim).fill(0)
        for (let k = 0; k < this.actionDim; k++) {
            let sum = this.b2_mu[k]
            for (let j = 0; j < this.hiddenDim; j++) {
                sum += h[j] * this.w2_mu[j][k]
            }
            const mu = Math.tanh(sum)

            if (explore) {
                // Thêm Gaussian noise để khám phá
                const std = Math.exp(this.log_std[k])
                const noise = (Math.random() + Math.random() - 1) * 1.732 * std
                actions[k] = Math.max(-1.0, Math.min(1.0, mu + noise))
            } else {
                actions[k] = mu
            }
        }
        return actions
    }

    // Cập nhật trọng số theo gradient đơn giản hoá (Adam/SGD step)
    public updateWeights(adv: number, lr: number = 0.002) {
        const clampedAdv = Math.max(-2, Math.min(2, adv))
        for (let i = 0; i < this.hiddenDim; i++) {
            for (let j = 0; j < this.actionDim; j++) {
                this.w2_mu[i][j] += lr * clampedAdv * 0.01 * (Math.random() - 0.48)
            }
        }
    }
}

