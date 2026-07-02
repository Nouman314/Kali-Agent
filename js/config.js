export const CONFIG = {
    ENDPOINTS: {
        CHAT: 'http://localhost:5000/chat',
        RESET: 'http://localhost:5000/reset',
        GRAMMAR: 'http://localhost:5000/grammar-fix',
        WORKSPACE_CHAT: 'http://localhost:5000/workspace-chat',
        WORKSPACE_RESET: 'http://localhost:5000/workspace-reset',
    },
    MODELS: {
        DEFAULT: 'gemini-3.1-flash-lite',
        OPTIONS: [
            {
                value: 'gemini-2.5-flash',
                label: 'Gemini 2.5 Flash',
                accent: '#4b3fd8',
            },
            {
                value: 'gemini-3.1-flash-lite',
                label: 'Gemini 3.1 Flash-Lite',
                accent: '#8b5cf6',
            },
            {
                value: 'gemini-2.5-flash-lite',
                label: 'Gemini 2.5 Flash-Lite',
                accent: '#10b981',
            },
        ],
    },
    COMPOSER: {
        DEFAULT_INPUT_HEIGHT: 100,
        MAX_INPUT_HEIGHT: 400,
        MIN_INPUT_HEIGHT: 100,
        MAX_ATTACHMENTS: 5,
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