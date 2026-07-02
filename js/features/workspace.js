import { dom } from '../dom.js';
import { state } from '../state.js';
import { formatFileSize } from './attachments.js';
import { formatCleanText } from '../utils/textFormat.js';
import { sendWorkspaceChatRequest, resetWorkspaceSession } from '../services/chatApi.js';

let workspaceBound = false;

const WORKSPACE_FILE_TYPES = [
    {
        id: 'pdf',
        label: 'PDF Document',
        description: 'Upload a PDF and ask questions, get summaries, or pull out key details.',
        accept: '.pdf,application/pdf',
        extensions: ['pdf'],
    },
    {
        id: 'ppt',
        label: 'PowerPoint',
        description: 'Chat with slide decks — pull talking points, summarize sections, and more.',
        accept: '.ppt,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint',
        extensions: ['ppt', 'pptx'],
    },
    {
        id: 'docx',
        label: 'Word Document',
        description: 'Analyze reports, contracts, or notes and ask follow-up questions.',
        accept: '.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword',
        extensions: ['doc', 'docx'],
    },
    {
        id: 'xlsx',
        label: 'Excel Spreadsheet',
        description: 'Explore spreadsheets and ask about trends, totals, or specific cells.',
        accept: '.xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
        extensions: ['xls', 'xlsx'],
    },
    {
        id: 'txt',
        label: 'Text File',
        description: 'Drop in plain text — logs, notes, or transcripts — and start chatting.',
        accept: '.txt,text/plain',
        extensions: ['txt'],
    },
    {
        id: 'md',
        label: 'Markdown',
        description: 'Chat with README files, docs, or markdown notes.',
        accept: '.md,.markdown,text/markdown',
        extensions: ['md', 'markdown'],
    },
];

const TYPE_ICONS = {
    pdf: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
            <path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z" />
            <path d="M17 18h2" /><path d="M20 15h-3v6" />
        </svg>`,
    ppt: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
            <path d="M5 21v-6h1.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1 -1.5 1.5h-1.5" />
            <path d="M11 21v-6h1.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1 -1.5 1.5h-1.5" />
            <path d="M17 15h4" /><path d="M19 15v6" />
        </svg>`,
    docx: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
            <path d="M5 15v6h1.5a1.5 1.5 0 0 0 1.5 -1.5v-3a1.5 1.5 0 0 0 -1.5 -1.5h-1.5" />
            <path d="M11 16.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0z" />
            <path d="M20 15h-1.5a1.5 1.5 0 0 0 -1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5h1.5" />
        </svg>`,
    xlsx: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
            <path d="M5 15h4v6h-4z" /><path d="M5 18h4" /><path d="M13 15h6" /><path d="M13 18h6" /><path d="M13 21h6" />
        </svg>`,
    txt: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" />
            <path d="M5 21v-4a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v4" />
            <path d="M9 17h6" /><path d="M9 21h6" />
        </svg>`,
    md: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z" />
            <path d="M7 15v-6l2.5 3l2.5 -3v6" /><path d="M14.5 12l2.5 3l2.5 -3m-2.5 3v-6" />
        </svg>`,
};

function getIconSvg(id) {
    return TYPE_ICONS[id] || TYPE_ICONS.txt;
}

function getTypeConfig(id) {
    return WORKSPACE_FILE_TYPES.find((type) => type.id === id);
}

// ---------- Landing grid ----------

export function renderWorkspaceCards() {
    if (!dom.workspaceGrid) return;
    dom.workspaceGrid.innerHTML = '';

    WORKSPACE_FILE_TYPES.forEach((type) => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.dataset.fileType = type.id;

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-card-icon-wrapper ${type.id}">${getIconSvg(type.id)}</div>
            </div>
            <div class="agent-card-title">${type.label}</div>
            <div class="agent-card-description">${type.description}</div>
            <div class="agent-card-footer">
                <button type="button" class="agent-card-action-btn">Open</button>
            </div>
        `;

        card.querySelector('.agent-card-action-btn').addEventListener('click', () => openSession(type.id));
        dom.workspaceGrid.appendChild(card);
    });
}

// ---------- View switching ----------

function showGridState() {
    if (dom.workspaceGridState) dom.workspaceGridState.hidden = false;
    if (dom.workspaceSession) dom.workspaceSession.hidden = true;
}

function showSessionState() {
    if (dom.workspaceGridState) dom.workspaceGridState.hidden = true;
    if (dom.workspaceSession) dom.workspaceSession.hidden = false;
}

function resetSession() {
    if (state.workspace.previewUrl) {
        URL.revokeObjectURL(state.workspace.previewUrl);
    }
    state.workspace.file = null;
    state.workspace.fileTextContent = null;
    state.workspace.previewUrl = null;
    state.workspace.messages = [];
    state.workspace.fileSent = false;
    state.workspace.isSending = false;
    resetWorkspaceSession();
}

function openSession(typeId) {
    const type = getTypeConfig(typeId);
    if (!type) return;

    // Switching to a different file type starts a fresh session.
    if (state.workspace.activeType !== typeId) {
        resetSession();
        state.workspace.activeType = typeId;
    }

    if (dom.workspaceSessionLabel) dom.workspaceSessionLabel.textContent = type.label;
    if (dom.workspaceSessionIcon) {
        dom.workspaceSessionIcon.className = `workspace-session-icon ${type.id}`;
        dom.workspaceSessionIcon.innerHTML = getIconSvg(type.id);
    }
    if (dom.workspaceFileInput) dom.workspaceFileInput.setAttribute('accept', type.accept);

    renderFilePane();
    renderChatPane();
    showSessionState();
}

function backToGrid() {
    showGridState();
    renderWorkspaceCards();
}

// ---------- File pane ----------

function isAcceptedFile(file, type) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return type.extensions.includes(ext);
}

function flashDropzoneError() {
    if (!dom.workspaceDropzone) return;
    dom.workspaceDropzone.classList.add('is-error');
    setTimeout(() => dom.workspaceDropzone.classList.remove('is-error'), 1500);
}

function handleFileSelected(file) {
    const type = getTypeConfig(state.workspace.activeType);
    if (!type) return;

    if (!isAcceptedFile(file, type)) {
        flashDropzoneError();
        return;
    }

    resetSession();
    state.workspace.activeType = type.id;
    state.workspace.file = file;

    renderFilePane();
    renderChatPane();
}

function removeFile() {
    resetSession();
    renderFilePane();
    renderChatPane();
}

function renderPreviewBody(file, type) {
    if (!dom.workspaceFilePreviewBody) return;
    dom.workspaceFilePreviewBody.innerHTML = '';

    if (type.id === 'pdf') {
        const url = URL.createObjectURL(file);
        state.workspace.previewUrl = url;
        const frame = document.createElement('iframe');
        frame.className = 'workspace-pdf-frame';
        frame.src = url;
        frame.title = file.name;
        dom.workspaceFilePreviewBody.appendChild(frame);
        return;
    }

    if (type.id === 'txt' || type.id === 'md') {
        const clean = document.createElement('div');
        clean.className = 'workspace-clean-preview';
        clean.innerHTML = '<p class="grammar-clean-paragraph">Loading preview…</p>';
        dom.workspaceFilePreviewBody.appendChild(clean);

        const reader = new FileReader();
        reader.onload = () => {
            const raw = typeof reader.result === 'string' ? reader.result : '';
            state.workspace.fileTextContent = raw;
            clean.innerHTML = formatCleanText(raw) || '<p class="grammar-clean-paragraph">This file is empty.</p>';
        };
        reader.onerror = () => {
            clean.innerHTML = '<p class="grammar-clean-paragraph">Could not read this file for preview.</p>';
        };
        reader.readAsText(file);
        return;
    }

    // docx / ppt / xlsx: no in-browser preview yet — this is the frontend-only stub.
    dom.workspaceFilePreviewBody.innerHTML = `
        <div class="workspace-preview-placeholder">
            <div class="workspace-preview-placeholder-icon">${getIconSvg(type.id)}</div>
            <p>Preview isn't available for ${escapeHtml(type.label)} yet</p>
            <span>The file is attached and ready — full previewing and answers will work once the backend is connected.</span>
        </div>
    `;
}

function renderFilePane() {
    const hasFile = !!state.workspace.file;

    if (dom.workspaceDropzone) dom.workspaceDropzone.hidden = hasFile;
    if (dom.workspaceFilePreview) dom.workspaceFilePreview.hidden = !hasFile;

    if (!hasFile) return;

    const file = state.workspace.file;
    const type = getTypeConfig(state.workspace.activeType);
    if (!type) return;

    if (dom.workspaceFileName) dom.workspaceFileName.textContent = file.name;
    if (dom.workspaceFileSize) dom.workspaceFileSize.textContent = formatFileSize(file.size);
    if (dom.workspaceFileIcon) {
        dom.workspaceFileIcon.className = `attachment-icon ${type.id}`;
        dom.workspaceFileIcon.innerHTML = getIconSvg(type.id);
    }

    renderPreviewBody(file, type);
}

// ---------- Chat pane (frontend-only for now) ----------

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function createWorkspaceBubble(role) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${role}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    Object.assign(bubble.style, {
        maxWidth: role === 'user' ? '80%' : '95%',
        padding: role === 'user' ? '7px 8px 10px 10px' : '7px 8px 10px 17px',
        borderRadius: role === 'user' ? '18px 18px 4px 18px' : '0',
        marginBottom: '4px',
        lineHeight: '1.5',
        fontSize: '14px',
        wordBreak: 'break-word',
        background: role === 'user' ? 'linear-gradient(135deg, #6073ea, #4b3fd8)' : 'transparent',
        color: role === 'user' ? '#fff' : '#111111',
        border: 'none',
    });

    wrapper.appendChild(bubble);
    return { wrapper, bubble };
}

function renderChatEmptyState(message) {
    if (!dom.workspaceChatArea) return;
    dom.workspaceChatArea.innerHTML = `<div class="empty-state workspace-chat-empty"><span>${escapeHtml(message)}</span></div>`;
}

function renderChatPane() {
    const hasFile = !!state.workspace.file;
    const file = state.workspace.file;

    if (dom.workspaceChatInput) {
        dom.workspaceChatInput.disabled = !hasFile;
        dom.workspaceChatInput.placeholder = hasFile
            ? `Ask something about ${file.name}...`
            : 'Upload a file to start chatting';
    }
    if (dom.workspaceSendBtn) dom.workspaceSendBtn.disabled = !hasFile;
    if (!dom.workspaceChatArea) return;

    dom.workspaceChatArea.innerHTML = '';

    if (!hasFile) {
        renderChatEmptyState('Upload a document on the left to start the conversation.');
        return;
    }

    if (!state.workspace.messages.length) {
        renderChatEmptyState(`Ask anything about "${file.name}".`);
        return;
    }

    state.workspace.messages.forEach((msg) => {
        const { wrapper, bubble } = createWorkspaceBubble(msg.role);
        bubble.textContent = msg.text;
        dom.workspaceChatArea.appendChild(wrapper);
    });

    dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;
}

function appendLiveBubble(role, text, persist = true) {
    if (!dom.workspaceChatArea) return null;

    const emptyState = dom.workspaceChatArea.querySelector('.workspace-chat-empty');
    if (emptyState) emptyState.closest('.empty-state')?.remove();

    const { wrapper, bubble } = createWorkspaceBubble(role);
    bubble.textContent = text;
    dom.workspaceChatArea.appendChild(wrapper);
    dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;

    if (persist) {
        state.workspace.messages.push({ role, text });
    }

    return bubble;
}

async function handleWorkspaceSend() {
    if (!dom.workspaceChatInput || !state.workspace.file || state.workspace.isSending) return;

    const text = dom.workspaceChatInput.value.trim();
    if (!text) return;

    dom.workspaceChatInput.value = '';
    dom.workspaceChatInput.style.height = 'auto';

    appendLiveBubble('user', text);

    const thinkingBubble = appendLiveBubble('ai', '', false);
    if (thinkingBubble) thinkingBubble.innerHTML = '<span class="shimmer-text">Thinking...</span>';

    state.workspace.isSending = true;
    if (dom.workspaceSendBtn) dom.workspaceSendBtn.disabled = true;

    try {
        const { data, ok } = await sendWorkspaceChatRequest({
            message: text,
            model: state.currentModel,
            // Only the first message needs to carry the file — the backend
            // keeps it in the document's own conversation history after that.
            file: state.workspace.fileSent ? null : state.workspace.file,
        });

        if (!ok) {
            const errorText = data.error || 'Something went wrong. Please try again.';
            if (thinkingBubble) thinkingBubble.textContent = errorText;
            state.workspace.messages.push({ role: 'ai', text: errorText });
            return;
        }

        state.workspace.fileSent = true;
        const reply = data.reply || "I couldn't find anything to say about that.";
        if (thinkingBubble) thinkingBubble.textContent = reply;
        state.workspace.messages.push({ role: 'ai', text: reply });
    } catch (err) {
        const errorText = 'Could not reach the backend. Is server.py running?';
        if (thinkingBubble) thinkingBubble.textContent = errorText;
        state.workspace.messages.push({ role: 'ai', text: errorText });
        console.error('[Kali Agent] Workspace chat error:', err);
    } finally {
        state.workspace.isSending = false;
        if (dom.workspaceSendBtn) dom.workspaceSendBtn.disabled = !state.workspace.file;
    }
}

// ---------- Bindings ----------

export function bindWorkspaceInteractions() {
    if (workspaceBound) return;
    workspaceBound = true;

    renderWorkspaceCards();

    dom.workspaceBackBtn?.addEventListener('click', backToGrid);

    dom.workspaceBrowseBtn?.addEventListener('click', () => dom.workspaceFileInput?.click());
    dom.workspaceDropzone?.addEventListener('click', (event) => {
        if (event.target.closest('.workspace-browse-btn')) return;
        dom.workspaceFileInput?.click();
    });

    dom.workspaceFileInput?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (file) handleFileSelected(file);
        event.target.value = '';
    });

    dom.workspaceRemoveFileBtn?.addEventListener('click', removeFile);

    ['dragenter', 'dragover'].forEach((evtName) => {
        dom.workspaceDropzone?.addEventListener(evtName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dom.workspaceDropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'drop'].forEach((evtName) => {
        dom.workspaceDropzone?.addEventListener(evtName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dom.workspaceDropzone.classList.remove('is-dragover');
        });
    });

    dom.workspaceDropzone?.addEventListener('drop', (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file) handleFileSelected(file);
    });

    dom.workspaceChatInput?.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    dom.workspaceChatInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleWorkspaceSend();
        }
    });

    dom.workspaceSendBtn?.addEventListener('click', handleWorkspaceSend);

    // Collapse the split view to a stacked layout when the panel gets narrow.
    if (dom.workspaceSplit && 'ResizeObserver' in window) {
        const observer = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                dom.workspaceSplit.classList.toggle('is-stacked', entry.contentRect.width < 520);
            });
        });
        observer.observe(dom.workspaceSplit);
    }
}