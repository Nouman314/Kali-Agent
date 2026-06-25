import { CONFIG } from '../config.js';

async function readJsonResponse(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

export async function sendChatRequest({ message, model, attachments = [], signal, systemInstruction }) {
    const hasAttachments = attachments.length > 0;
    let response;

    if (hasAttachments) {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('model', model);
        if (systemInstruction) {
            formData.append('system_instruction', systemInstruction);
        }
        attachments.forEach((entry) => {
            formData.append('attachments', entry.file, entry.file.name);
        });

        response = await fetch(CONFIG.ENDPOINTS.CHAT, {
            method: 'POST',
            body: formData,
            signal,
        });
    } else {
        response = await fetch(CONFIG.ENDPOINTS.CHAT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, model, system_instruction: systemInstruction }),
            signal,
        });
    }

    const data = await readJsonResponse(response);
    return {
        response,
        data,
        ok: response.ok && !data.error,
    };
}

export async function resetChatSession() {
    try {
        await fetch(CONFIG.ENDPOINTS.RESET, { method: 'POST' });
    } catch {
        // Reset is best-effort.
    }
}

export async function sendGrammarFixRequest({ text, signal }) {
    const response = await fetch(CONFIG.ENDPOINTS.GRAMMAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal,
    });

    const data = await readJsonResponse(response);
    return {
        response,
        data,
        ok: response.ok && !data.error,
    };
}