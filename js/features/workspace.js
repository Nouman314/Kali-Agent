import { CONFIG } from '../config.js';
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

const AGENT_ICONS = {
    terminal: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>`,
    shield: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>`,
    radar: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
        </svg>`,
    search: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>`,
    code: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
        </svg>`,
};

function getIconSvg(id) {
    return TYPE_ICONS[id] || TYPE_ICONS.txt;
}

function getTypeConfig(id) {
    return WORKSPACE_FILE_TYPES.find((type) => type.id === id);
}

function renderMarkdown(text) {
    if (typeof marked === 'undefined') return text;
    return marked.parse(text);
}

function highlightCodeBlocks(root) {
    if (typeof hljs === 'undefined') return;
    root.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

async function typeWorkspaceText(element, text, speed = CONFIG.TYPEWRITER.SPEED_MS) {
    element.innerHTML = '';
    let i = 0;

    return new Promise((resolve) => {
        function type() {
            if (i < text.length) {
                i = Math.min(i + CONFIG.TYPEWRITER.CHUNK_SIZE, text.length);
                element.innerHTML = renderMarkdown(text.slice(0, i));
                if (dom.workspaceChatArea) {
                    dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;
                }
                setTimeout(type, speed);
                return;
            }

            element.innerHTML = renderMarkdown(text);
            highlightCodeBlocks(element);
            if (dom.workspaceChatArea) {
                dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;
            }
            resolve();
        }

        type();
    });
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

// ---------- Chat pane ----------

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderUserBubbleText(bubble, text) {
    bubble.innerHTML = '';
    bubble.classList.remove('has-show-more');

    const textSpan = document.createElement('span');
    textSpan.className = 'user-bubble-text';
    textSpan.textContent = text;
    bubble.appendChild(textSpan);

    requestAnimationFrame(() => {
        const collapseLimit = 168;
        if (textSpan.scrollHeight > collapseLimit) {
            bubble.classList.add('has-show-more');
            textSpan.classList.add('is-collapsed');

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'show-more-btn';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.innerHTML = `<span class="show-more-btn__label">See more</span>
                <span class="show-more-btn__icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M7.5 10.5L12 15l4.5-4.5"/>
                    </svg>
                </span>`;

            bubble.appendChild(toggleBtn);
        }
    });
}

function createBubbleActions(role) {
    const actions = document.createElement('div');
    actions.className = 'bubble-actions';

    if (role === 'user') {
        actions.innerHTML = `<button type="button" title="Edit" aria-label="Edit">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M9 7h-3a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-3" />
                   <path d="M9 15h3l8.5 -8.5a1.5 1.5 0 0 0 -3 -3l-8.5 8.5v3" />
                   <path d="M16 5l3 3" />
               </svg>
           </button>
           <button type="button" title="Copy" aria-label="Copy">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <rect x="9" y="9" width="13" height="13" rx="2.5" ry="2.5"></rect>
                   <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
               </svg>
           </button>`;
        return actions;
    }

    actions.innerHTML = `<button type="button" title="Copy" aria-label="Copy">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <rect x="9" y="9" width="13" height="13" rx="2.5" ry="2.5"></rect>
                   <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
               </svg>
           </button>
           <button type="button" title="Like" aria-label="Like">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
               </svg>
           </button>
           <button type="button" title="Dislike" aria-label="Dislike">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
               </svg>
           </button>
           <button type="button" title="Retry" aria-label="Retry">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                   <path d="M21 3v5h-5"></path>
                   <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                   <path d="M3 21v-5h5"></path>
               </svg>
           </button>`;

    return actions;
}

function setButtonCopyFeedback(button, originalHTML) {
    const svg = button.querySelector('svg');
    if (!svg) return;

    svg.innerHTML = '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>';
    svg.style.stroke = '#22c55e';
    setTimeout(() => {
        svg.innerHTML = originalHTML;
        svg.style.stroke = '';
    }, 1500);
}

function copyBubbleText(button, bubble) {
    const text = bubble.dataset.rawText || bubble.textContent || '';
    navigator.clipboard.writeText(text).catch(() => {});
    const svg = button.querySelector('svg');
    if (svg) {
        setButtonCopyFeedback(button, svg.innerHTML);
    }
}

function toggleBubbleLike(button, activeColor, otherSelector) {
    const isActive = button.style.color === activeColor;
    button.style.color = isActive ? '' : activeColor;

    const wrapper = button.closest('.message-wrapper');
    const otherButton = wrapper?.querySelector(otherSelector);
    if (otherButton) otherButton.style.color = '';
}

function renderWorkspaceMessageBubble(bubble, role, text) {
    bubble.dataset.rawText = text;

    if (role === 'ai') {
        bubble.innerHTML = text ? renderMarkdown(text) : '';
        highlightCodeBlocks(bubble);
        return;
    }

    renderUserBubbleText(bubble, text);
}

function getWorkspaceMessageIndex(wrapper) {
    const index = Number(wrapper?.dataset.messageIndex);
    return Number.isFinite(index) ? index : -1;
}

function trimWorkspaceMessagesFrom(index) {
    if (index < 0) return;
    state.workspace.messages = state.workspace.messages.slice(0, index);
}

function removeWorkspaceDomAfter(wrapper) {
    let next = wrapper?.nextElementSibling || null;
    while (next) {
        const current = next;
        next = next.nextElementSibling;
        current.remove();
    }
}

function restoreEditableBubble(bubble, actions, text) {
    bubble.classList.remove('chat-bubble--editing');
    bubble.style.width = '';
    bubble.style.maxWidth = '80%';
    delete bubble.dataset.editWidth;
    bubble.dataset.rawText = text;
    renderUserBubbleText(bubble, text);
    actions.style.display = 'flex';
}

function ensureBubbleActions(wrapper, role) {
    if (!wrapper || wrapper.querySelector('.bubble-actions')) return;
    wrapper.appendChild(createBubbleActions(role));
}

function createWorkspaceBubble(role, showActions = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${role}`;

    if (role === 'ai') {
        const agentHeader = document.createElement('div');
        agentHeader.className = 'ai-agent-header';

        const activeAgent = state.activeAgent;
        if (activeAgent) {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = `ai-agent-icon-wrapper ${activeAgent.icon}`;
            iconWrapper.innerHTML = AGENT_ICONS[activeAgent.icon] || AGENT_ICONS.terminal;

            const agentName = document.createElement('span');
            agentName.textContent = activeAgent.name;

            agentHeader.appendChild(iconWrapper);
            agentHeader.appendChild(agentName);
        } else {
            const agentIcon = document.createElement('img');
            agentIcon.src = chrome.runtime.getURL('icons/icon400.png');
            agentIcon.className = 'ai-agent-icon';

            const agentName = document.createElement('span');
            agentName.textContent = 'Kali Agent';

            agentHeader.appendChild(agentIcon);
            agentHeader.appendChild(agentName);
        }
        wrapper.appendChild(agentHeader);
    }

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
    if (showActions) {
        wrapper.appendChild(createBubbleActions(role));
    }

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

    state.workspace.messages.forEach((msg, index) => {
        const { wrapper, bubble } = createWorkspaceBubble(msg.role, msg.showActions !== false);
        wrapper.dataset.messageIndex = String(index);
        renderWorkspaceMessageBubble(bubble, msg.role, msg.text);
        dom.workspaceChatArea.appendChild(wrapper);
    });

    highlightCodeBlocks(dom.workspaceChatArea);
    dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;
}

function handleBubbleActionClick(event) {
    const showMoreButton = event.target.closest('.show-more-btn');
    if (showMoreButton) {
        const textSpan = showMoreButton.parentElement?.querySelector('.user-bubble-text');
        if (!textSpan) return;

        const collapsed = textSpan.classList.toggle('is-collapsed');
        showMoreButton.classList.toggle('is-expanded', !collapsed);
        showMoreButton.setAttribute('aria-expanded', String(!collapsed));
        const label = showMoreButton.querySelector('.show-more-btn__label');
        if (label) label.textContent = collapsed ? 'See more' : 'See less';
        return;
    }

    const button = event.target.closest('.bubble-actions button');
    if (!button || !dom.workspaceChatArea.contains(button)) return;

    const wrapper = button.closest('.message-wrapper');
    const bubble = wrapper?.querySelector('.chat-bubble');
    if (!wrapper || !bubble) return;

    const title = button.getAttribute('title');

    if (title === 'Copy') {
        copyBubbleText(button, bubble);
        return;
    }

    if (title === 'Edit') {
        if (button.classList.contains('disabled')) return;
        beginWorkspaceBubbleEdit(wrapper, bubble, wrapper.querySelector('.bubble-actions'));
        return;
    }

    if (title === 'Like') {
        toggleBubbleLike(button, '#4b3fd8', '[title="Dislike"]');
        return;
    }

    if (title === 'Dislike') {
        toggleBubbleLike(button, '#ef4444', '[title="Like"]');
        return;
    }

    if (title === 'Retry') {
        const svg = button.querySelector('svg');
        if (svg) {
            svg.classList.add('spin-once');
            svg.addEventListener('animationend', () => svg.classList.remove('spin-once'), { once: true });
        }

        retryWorkspaceLastMessage();
    }
}

function beginWorkspaceBubbleEdit(wrapper, bubble, actions) {
    if (state.workspace.isSending) return;

    actions.style.display = 'none';
    const currentText = bubble.dataset.rawText || bubble.textContent || '';
    const messageIndex = getWorkspaceMessageIndex(wrapper);
    const bubbleWidth = Math.max(280, Math.ceil(bubble.getBoundingClientRect().width));

    bubble.classList.add('chat-bubble--editing');
    bubble.dataset.editWidth = `${bubbleWidth}px`;
    bubble.style.width = bubble.dataset.editWidth;
    bubble.style.maxWidth = bubble.dataset.editWidth;
    bubble.textContent = '';

    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.innerHTML = `
        <textarea class="edit-textarea"></textarea>
        <div class="edit-actions">
            <button type="button" class="edit-btn edit-btn-cancel">Cancel</button>
            <button type="button" class="edit-btn edit-btn-save">Save & Send</button>
        </div>
    `;
    bubble.appendChild(editContainer);

    const textarea = editContainer.querySelector('.edit-textarea');
    textarea.value = currentText;
    textarea.focus();
    textarea.style.height = textarea.scrollHeight + 'px';

    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    });

    editContainer.querySelector('.edit-btn-cancel').addEventListener('click', () => {
        restoreEditableBubble(bubble, actions, currentText);
    });

    editContainer.querySelector('.edit-btn-save').addEventListener('click', () => {
        const newText = textarea.value.trim();
        if (!newText) return;

        bubble.dataset.rawText = newText;
        restoreEditableBubble(bubble, actions, newText);

        if (messageIndex >= 0 && state.workspace.messages[messageIndex]) {
            state.workspace.messages[messageIndex].text = newText;
            state.workspace.messages[messageIndex].showActions = true;
            trimWorkspaceMessagesFrom(messageIndex + 1);
        }

        removeWorkspaceDomAfter(wrapper);
        requestWorkspaceResponse(newText);
    });
}

function retryWorkspaceLastMessage() {
    const userWrappers = dom.workspaceChatArea?.querySelectorAll('.message-wrapper--user');
    const lastUserWrapper = userWrappers?.[userWrappers.length - 1];
    const lastUserBubble = lastUserWrapper?.querySelector('.chat-bubble');
    const lastUserText = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;
    if (!lastUserText || !lastUserWrapper) return;

    const lastUserIndex = getWorkspaceMessageIndex(lastUserWrapper);
    trimWorkspaceMessagesFrom(lastUserIndex);
    removeWorkspaceDomAfter(lastUserWrapper);
    lastUserWrapper.remove();

    appendLiveBubble('user', lastUserText);
    requestWorkspaceResponse(lastUserText);
}

async function requestWorkspaceResponse(text) {
    const aiBubble = appendLiveBubble('ai', '', false, false);
    if (!aiBubble) return false;

    state.workspace.isSending = true;
    if (dom.workspaceSendBtn) dom.workspaceSendBtn.disabled = true;

    dom.workspaceChatArea.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach((btn) => {
        btn.classList.add('disabled');
    });

    aiBubble.innerHTML = '<span class="shimmer-text">Thinking...</span>';

    try {
        const { data, ok } = await sendWorkspaceChatRequest({
            message: text,
            model: state.currentModel,
            file: state.workspace.fileSent ? null : state.workspace.file,
        });

        if (!ok) {
            const errorText = data.error || 'Something went wrong. Please try again.';
            aiBubble.textContent = errorText;
            state.workspace.messages.push({ role: 'ai', text: errorText, showActions: false });
            return false;
        }

        state.workspace.fileSent = true;
        const reply = data.reply || "I couldn't find anything to say about that.";
        aiBubble.dataset.rawText = reply;
        await typeWorkspaceText(aiBubble, reply, CONFIG.TYPEWRITER.SPEED_MS);

        const aiWrapper = aiBubble.closest('.message-wrapper');
        ensureBubbleActions(aiWrapper, 'ai');

        state.workspace.messages.push({ role: 'ai', text: reply, showActions: true });
        return true;
    } catch (err) {
        const errorText = 'Could not reach the backend. Is server.py running?';
        aiBubble.textContent = errorText;
        state.workspace.messages.push({ role: 'ai', text: errorText, showActions: false });
        console.error('[Kali Agent] Workspace chat error:', err);
        return false;
    } finally {
        state.workspace.isSending = false;
        if (dom.workspaceSendBtn) dom.workspaceSendBtn.disabled = !state.workspace.file;

        if (dom.workspaceChatArea) {
            dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;
        }

        dom.workspaceChatArea.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach((btn) => {
            btn.classList.remove('disabled');
        });
    }
}

function appendLiveBubble(role, text, persist = true, showActions = role === 'user') {
    if (!dom.workspaceChatArea) return null;

    const emptyState = dom.workspaceChatArea.querySelector('.workspace-chat-empty');
    if (emptyState) emptyState.closest('.empty-state')?.remove();

    const { wrapper, bubble } = createWorkspaceBubble(role, showActions);
    wrapper.dataset.messageIndex = String(state.workspace.messages.length);
    renderWorkspaceMessageBubble(bubble, role, text);
    dom.workspaceChatArea.appendChild(wrapper);
    dom.workspaceChatArea.scrollTop = dom.workspaceChatArea.scrollHeight;

    if (persist) {
        state.workspace.messages.push({ role, text, showActions });
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
    requestWorkspaceResponse(text);
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

    dom.workspaceChatArea?.addEventListener('click', handleBubbleActionClick);

    const workspaceInputWrapper = dom.workspaceChatInput?.closest('.input-box-wrapper');
    if (workspaceInputWrapper && dom.workspaceChatInput) {
        const updateResizeCursor = (event) => {
            if (state.isResizing) return;

            const isTopEdge = event.clientY - workspaceInputWrapper.getBoundingClientRect().top < 8;
            const cursor = isTopEdge ? 'ns-resize' : 'text';
            workspaceInputWrapper.style.cursor = cursor;
            dom.workspaceChatInput.style.cursor = cursor;
        };

        const tryStartResize = (event) => {
            const isTopEdge = event.clientY - workspaceInputWrapper.getBoundingClientRect().top < 8;
            if (!isTopEdge) return;

            state.isResizing = true;
            state.startY = event.clientY;
            state.startHeight = dom.workspaceChatInput.getBoundingClientRect().height;
            event.preventDefault();
        };

        workspaceInputWrapper.addEventListener('mousemove', updateResizeCursor);
        dom.workspaceChatInput.addEventListener('mousemove', updateResizeCursor);
        workspaceInputWrapper.addEventListener('mousedown', tryStartResize);
        dom.workspaceChatInput.addEventListener('mousedown', tryStartResize);
    }

    document.addEventListener('mousemove', (event) => {
        if (!state.isResizing || !dom.workspaceChatInput) return;
        const newHeight = Math.min(
            CONFIG.COMPOSER.MAX_INPUT_HEIGHT,
            Math.max(CONFIG.COMPOSER.MIN_INPUT_HEIGHT, state.startHeight + (state.startY - event.clientY))
        );
        dom.workspaceChatInput.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        state.isResizing = false;
    });

    if (dom.workspaceSplit && 'ResizeObserver' in window) {
        const observer = new ResizeObserver((entries) => {
            entries.forEach((entry) => {
                dom.workspaceSplit.classList.toggle('is-stacked', entry.contentRect.width < 520);
            });
        });
        observer.observe(dom.workspaceSplit);
    }
}
