'use client'

import React from 'react'
import { NvidiaRobotRenderer, AgentFormType } from './NvidiaRobots'
import type { AgentBodyDesign } from '@/lib/agentBody/agentBodyTypes'

type Props = {
    color?: string
    promptColor?: string | null
    toolsColor?: string | null
    modelColor?: string | null
    sitting?: boolean
    walking?: boolean
    working?: boolean
    form?: AgentFormType
    bodyId?: string | null
    bodyDesign?: AgentBodyDesign | null
}

const AgentBody = React.memo(function AgentBody({
    color = '#76b900',
    sitting = false,
    walking = false,
    working = false,
    form = 'humanoid',
    bodyId,
    bodyDesign,
}: Props) {
    return (
        <NvidiaRobotRenderer
            form={form}
            color={color}
            sitting={sitting}
            walking={walking}
            working={working}
            bodyId={bodyId}
            bodyDesign={bodyDesign}
        />
    )
})

export default AgentBody