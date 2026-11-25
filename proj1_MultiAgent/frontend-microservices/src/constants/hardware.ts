export const HARDWARE_RAM_TIERS = [
    {
        minRAM: 16,
        models: ['Llama-3-8B-Instruct (4-bit)', 'DeepSeek-R1-Distill-7B'],
    },
    {
        minRAM: 8,
        models: ['Phi-3-mini-4k', 'Qwen-1.5-1.8B', 'Gemma-2B'],
    },
    {
        minRAM: 4,
        models: ['Qwen-0.5B-Chat', 'TinyLlama-1.1B'],
    },
] as const