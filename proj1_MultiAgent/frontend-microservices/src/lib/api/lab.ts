import { request } from '../client'

export type LabStage = {
    step: number
    agent_id: string
    agent_name: string
    agent_color: string
    role: string
    action: string
    speech: string
    notes?: string
    libraries?: string[]
    prompt_preview?: string
    sandbox_output?: string
    sandbox_success?: boolean
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    timestamp: string
}

export type LabTemplate = {
    id: string
    title: string
    goal: string
    category: string
    icon: string
    recommended_model: string
    color: string
}

export type LabSynthesisResponse = {
    success: boolean
    goal: string
    agent_blueprint: {
        id: string
        name: string
        role: string
        color: string
        model: string
        prompt_id: string
        tool_id: string
    }
    stages: LabStage[]
    artifacts: {
        system_prompt: string
        python_code: string
        tool_schema: string
        sandbox_result: {
            success: boolean
            output: string
            execution_time_ms?: number
            is_container?: boolean
        }
    }
    generated_files?: {
        tool_py?: string
        tool_path?: string
        prompt_md?: string
        prompt_json?: string
        prompt_path?: string
        model_json?: string
        model_path?: string
        agent_manifest?: string
        agent_path?: string
    }
    database_records?: {
        agent?: any
        prompt?: any
        tool?: any
        db_error?: string
    }
}

export type GeneratedFileInfo = {
    name: string
    filename?: string
    type: 'tool' | 'prompt' | 'model' | 'agent' | string
    path?: string
    relative_path: string
    size_bytes: number
    modified_at?: string
    updated_at?: string
}

export type GeneratedFileList = {
    total_files?: number
    counts?: {
        tools?: number
        prompts?: number
        models?: number
        agents?: number
    }
    files?: GeneratedFileInfo[]
    tools?: Array<{ filename: string; path: string; size_bytes: number; updated_at: string }>
    prompts?: Array<{ filename: string; path: string; size_bytes: number; updated_at: string }>
    models?: Array<{ filename: string; path: string; size_bytes: number; updated_at: string }>
    agents?: Array<{ filename: string; path: string; size_bytes: number; updated_at: string }>
}

export const labApi = {
    getTemplates: () => request<LabTemplate[]>('/lab/templates'),
    generateAgent: (payload: { goal: string; target_model?: string; save_to_db?: boolean }) =>
        request<LabSynthesisResponse>('/lab/generate', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    listGeneratedFiles: () => request<GeneratedFileList>('/lab/generated-files'),
}
