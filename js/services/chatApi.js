import { CONFIG } from '../config.js';

async function readJsonResponse(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

export async function sendChatRequest({
    message,
    model,
    attachments = [],
    history = [],
    signal,
    systemInstruction,
    webSearch = false,
    codingMode = false,
    onProgress,
}) {
    const hasAttachments = attachments.length > 0;
    const endpoint = codingMode ? CONFIG.ENDPOINTS.CODING_CHAT : CONFIG.ENDPOINTS.CHAT;
    const headers = webSearch
        ? { Accept: 'application/x-ndjson' }
        : undefined;
    let response;

    if (hasAttachments) {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('model', model);
        formData.append('web_search', webSearch ? 'true' : 'false');
        formData.append('history', JSON.stringify(history));
        if (systemInstruction) {
            formData.append('system_instruction', systemInstruction);
        }
        attachments.forEach((entry) => {
            formData.append('attachments', entry.file, entry.file.name);
        });

        response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: formData,
            signal,
        });
    } else {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(headers || {}),
            },
            body: JSON.stringify({
                message,
                model,
                history,
                system_instruction: systemInstruction,
                web_search: webSearch,
            }),
            signal,
        });
    }

    if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
        return readProgressResponse(response, onProgress);
    }

    const data = await readJsonResponse(response);
    return {
        response,
        data,
        ok: response.ok && !data.error,
    };
}

async function readProgressResponse(response, onProgress) {
    if (!response.ok) {
        const data = await readJsonResponse(response);
        return { response, data, ok: false };
    }

    const reader = response.body?.getReader();
    if (!reader) {
        return {
            response,
            data: { error: 'The web search progress stream is unavailable.' },
            ok: false,
        };
    }

    const decoder = new TextDecoder();
    let pending = '';
    let result = null;
    let streamError = null;

    const handleLine = (line) => {
        if (!line.trim()) return;

        const event = JSON.parse(line);
        if (event.type === 'result') {
            result = event.data;
        } else if (event.type === 'error') {
            streamError = { error: event.error, code: event.code };
        } else if (onProgress) {
            onProgress(event);
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = pending.split('\n');
        pending = lines.pop();
        lines.forEach(handleLine);
        if (done) break;
    }
    if (pending.trim()) handleLine(pending);

    if (streamError) {
        return { response, data: streamError, ok: false };
    }
    if (!result || typeof result.reply !== 'string') {
        return {
            response,
            data: { error: 'The web search stream ended before the answer was ready.' },
            ok: false,
        };
    }

    return { response, data: result, ok: true };
}

export async function sendSummaryRequest({ text, model, signal }) {
    const response = await fetch(CONFIG.ENDPOINTS.SUMMARIZE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
        signal,
    });

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

export async function sendWorkspaceChatRequest({ message, model, file, signal }) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('model', model);

    if (file) {
        formData.append('attachments', file, file.name);
    }

    const response = await fetch(CONFIG.ENDPOINTS.WORKSPACE_CHAT, {
        method: 'POST',
        body: formData,
        signal,
    });

    const data = await readJsonResponse(response);
    return {
        response,
        data,
        ok: response.ok && !data.error,
    };
}

export async function resetWorkspaceSession() {
    try {
        await fetch(CONFIG.ENDPOINTS.WORKSPACE_RESET, { method: 'POST' });
    } catch {
        // Reset is best-effort.
    }
}