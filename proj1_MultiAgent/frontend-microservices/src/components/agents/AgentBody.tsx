'use client'

import React from 'react'
import { NvidiaRobotRenderer, AgentFormType } from './NvidiaRobots'

type Props = {
    color?: string
    promptColor?: string | null
    toolsColor?: string | null
    modelColor?: string | null
    sitting?: boolean
    walking?: boolean
    working?: boolean
    form?: 'humanoid' | 'duck' | 'amr' | 'drone'
}

const AgentBody = React.memo(function AgentBody({
    color = '#76b900',
    sitting = false,
    walking = false,
    working = false,
    form = 'humanoid',
}: Props) {
    return (
        <NvidiaRobotRenderer
            form={form as AgentFormType}
            color={color}
            sitting={sitting}
            walking={walking}
            working={working}
        />
    )
})

export default AgentBody