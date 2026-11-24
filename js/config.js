export const CONFIG = {
    ENDPOINTS: {
        CHAT: 'http://localhost:5000/chat',
        CODING_CHAT: 'http://localhost:5000/coding-chat',
        SUMMARIZE: 'http://localhost:5000/summarize',
        RESET: 'http://localhost:5000/reset',
        GRAMMAR: 'http://localhost:5000/grammar-fix',
        WORKSPACE_CHAT: 'http://localhost:5000/workspace-chat',
        WORKSPACE_RESET: 'http://localhost:5000/workspace-reset',
    },
    MODELS: {
        DEFAULT: 'gemini-3.1-flash-lite',
        OPTIONS: [
            {
                value: 'gemini-4-argon',
                label: 'Gemini 4 Argon',
                accent: '#4b3fd8',
            },
            {
                value: 'gemini-3.8-flash',
                label: 'Gemini 3.8 Flash',
                accent: '#8b5cf6',
            },
            {
                value: 'gemini-3.6-flash',
                label: 'Gemini 3.6 Flash',
                accent: '#10b981',
            },
            {
                value: 'gemini-3.1-flash-lite',
                label: 'Gemini 3.1 Flash-Lite',
                accent: '#f59e0b',
            },
        ],
    },
    COMPOSER: {
        DEFAULT_INPUT_HEIGHT: 100,
        MAX_INPUT_HEIGHT: 400,
        MIN_INPUT_HEIGHT: 100,
        MAX_ATTACHMENTS: 5,
        MAX_CODING_ATTACHMENTS: 40,
        MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    },
    GRAMMAR: {
        MAX_CHARS: 8000,
    },
    TYPEWRITER: {
        CHUNK_SIZE: 5,
        SPEED_MS: 1,
    },
    THINKING_PHRASES: [
        'Thinking...',
        'Processing...',
        'Analyzing...',
        'Generating...',
        'Almost there...',
    ],
};

export function configureMarkdownRenderer() {
    if (typeof marked === 'undefined' || typeof marked.Renderer !== 'function') {
        return;
    }

    const renderer = new marked.Renderer();
    renderer.hr = () => '';
    marked.setOptions({ renderer });
}