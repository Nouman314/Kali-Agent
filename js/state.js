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
};
