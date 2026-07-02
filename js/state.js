import { CONFIG } from './config.js';

export const state = {
    currentModel: CONFIG.MODELS.DEFAULT,
    isAiResponding: false,
    abortController: null,
    userHasScrolledUp: false,
    isResizing: false,
    startY: 0,
    startHeight: 0,
    attachedFiles: [],
    attachmentIdCounter: 0,
    activeAgent: null, // Tracks selected agent { id, name, systemInstruction, icon }
    workspace: {
        activeType: null, // 'pdf' | 'ppt' | 'docx' | 'xlsx' | 'txt' | 'md'
        file: null, // The uploaded File object
        fileTextContent: null, // Cached text content for txt/md previews
        previewUrl: null, // Object URL used for the PDF preview iframe
        messages: [], // { role: 'user' | 'ai', text }[] — frontend-only for now
    },
};
