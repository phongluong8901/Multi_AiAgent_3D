'use client'

import { RigidBody } from '@react-three/rapier'
import Building from './Building'
import House from './House'
import IndustrialBuilding from './IndustrialBuilding'
import Road from './Road'
import StreetLight from './StreetLight'
import Agent from '../agents/Agent'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from '../agents/Agent'

type Props = {
    agents: AgentType[]
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: [number, number, number]) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
}

export default function SmartCity({
    agents,
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: Props) {
    return (
        <group>
            {/* ===== ĐẤT ===== */}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0, 0]}
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation()
                        onFloorClick?.([e.point.x, 0, e.point.z])
                    }}
                >
                    <planeGeometry args={[90, 90]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
            </RigidBody>

            {/* ===== ĐƯỜNG ===== */}
            <Road position={[0, 0.02, 0]} width={9} length={80} />
            <Road position={[0, 0.02, 14]} width={7} length={50} rotation={Math.PI / 2} />
            <Road position={[0, 0.02, -14]} width={7} length={50} rotation={Math.PI / 2} />

            {/* ===== NHÀ Ở ===== */}
            <House position={[-16, 0, -10]} color="#f1f5f9" />
            <House position={[-16, 0, -2]} color="#e2e8f0" />
            <House position={[-22, 0, -6]} color="#f8fafc" />
            <House position={[-16, 0, 8]} color="#f1f5f9" />

            {/* ===== TÒA NHÀ ===== */}
            <Building position={[14, 0, -12]} width={5} height={11} depth={5} color="#64748b" />
            <Building position={[22, 0, -8]} width={4.5} height={9} depth={4.5} color="#475569" />
            <Building position={[18, 0, 6]} width={6} height={14} depth={5} color="#334155" />
            <Building position={[12, 0, 16]} width={5} height={10} depth={5} color="#64748b" />

            {/* ===== KHU CÔNG NGHIỆP ===== */}
            <IndustrialBuilding position={[8, 0, 22]} />
            <IndustrialBuilding position={[18, 0, 24]} />

            {/* ===== ĐÈN ĐƯỜNG ===== */}
            <StreetLight position={[-6, 0, -18]} />
            <StreetLight position={[6, 0, -18]} />
            <StreetLight position={[-6, 0, -4]} />
            <StreetLight position={[6, 0, -4]} />
            <StreetLight position={[-6, 0, 10]} />
            <StreetLight position={[6, 0, 10]} />
            <StreetLight position={[-6, 0, 22]} />
            <StreetLight position={[6, 0, 22]} />

            {/* ===== AGENTS ===== */}
            {agents.map((agent) => {
                const target = agentTargetActions[agent.id]
                return (
                    <Agent
                        key={agent.id}
                        id={agent.id}
                        position={agent.position || [0, 0, 0]}
                        color={agent.color}
                        name={agent.name}
                        status={agent.status}
                        speech={agent.speech}
                        isSelected={selectedAgentId === agent.id}
                        onSelect={() => onSelectAgent?.(agent.id)}
                        targetAction={target?.action}
                        targetPosition={target?.targetPos}
                        ownerName={agent.ownerName}
                    />
                )
            })}
        </group>
    )
}