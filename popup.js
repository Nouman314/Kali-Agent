// ── Styles ──────────────────────────────────────────────────────
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes textShimmer {
            0%   { background-position: 100% center; }
            100% { background-position: -100% center; }
        }
        .shimmer-text {
            display: inline;
            background: linear-gradient(
                90deg,
                #52525b 0%, #52525b 20%, #f4f4f5 45%,
                #09090b 50%, #f4f4f5 55%, #52525b 80%, #52525b 100%
            );
            background-size: 400% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: textShimmer 1.8s ease-in-out infinite;
        }
        @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .chat-bubble {
            animation: bubbleFadeIn 0.25s ease-out forwards;
        }
        @keyframes phraseSlideUp {
            0%   { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .phrase-wrapper {
            display: inline-block;
            animation: phraseSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .model-option:hover { background: #f3f4f6; }
    `;
    document.head.appendChild(style);
})();

// ── Constants ────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:5000/chat';
const RESET_URL = 'http://localhost:5000/reset';
let currentModel = 'gemini-3.1-flash-lite';
let isAiResponding = false;
let abortController = null;
let userHasScrolledUp = false;

const THINKING_PHRASES = [
    'Thinking...', 'Processing...', 'Analyzing...',
    'Generating...', 'Almost there...'
];

const DEFAULT_INPUT_HEIGHT = 100;

const renderer = new marked.Renderer();
renderer.hr = () => '';
marked.setOptions({ renderer });

// ── DOM References ───────────────────────────────────────────────
const inputBox = document.querySelector('.input-box');
const inputWrapper = document.querySelector('.input-box-wrapper');
const attachmentInput = document.getElementById('attachmentInput');
const attachmentTray = document.getElementById('attachmentTray');
const attachmentError = document.getElementById('attachmentError');
const chatArea = document.querySelector('.chat-area');
const emptyStateTemplate = document.getElementById('emptyStateTemplate');
const EMPTY_STATE_HTML = emptyStateTemplate ? emptyStateTemplate.innerHTML.trim() : '';
const modelSelectBtn = document.getElementById('modelSelectBtn');
const modelDropdown = document.getElementById('modelDropdown');
const selectedModelText = document.getElementById('selectedModelText');
const modelOptions = document.querySelectorAll('.model-option');
const sidebarShell = document.querySelector('.sidebar-shell');
const sendBtn = document.querySelector('.send-btn');
const sendBtnIcon = sendBtn?.querySelector('.send-btn-icon');

function setSendButtonState(isStopping) {
    if (!sendBtn || !sendBtnIcon) return;

    if (isStopping) {
        sendBtn.setAttribute('aria-label', 'Stop');
        sendBtn.setAttribute('data-tooltip', 'Stop');
        sendBtnIcon.style.transform = 'scale(1.12)';
        sendBtnIcon.style.transformOrigin = 'center';
        sendBtnIcon.innerHTML = '<rect x="5" y="5" width="14" height="14" rx="3.5" ry="3.5" fill="currentColor" stroke="none" />';
    } else {
        sendBtn.setAttribute('aria-label', 'Send');
        sendBtn.setAttribute('data-tooltip', 'Send');
        sendBtnIcon.style.transform = '';
        sendBtnIcon.style.transformOrigin = '';
        sendBtnIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />';
    }
}

chatArea.addEventListener('scroll', () => {
    const distanceFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    userHasScrolledUp = distanceFromBottom > 60;
});

// ── Resize State ─────────────────────────────────────────────────
let isResizing = false;
let startY = 0;
let startHeight = 0;

let attachedFiles = [];
let attachmentIdCounter = 0;

// ── Helpers ──────────────────────────────────────────────────────

// showActions = false is used for the thinking bubble so icons don't appear before a real reply
function renderEmptyState() {
    if (!chatArea || !EMPTY_STATE_HTML) return;
    chatArea.innerHTML = EMPTY_STATE_HTML;
}

function hideEmptyState() {
    const currentEmptyState = chatArea.querySelector('.empty-state');
    if (currentEmptyState) currentEmptyState.style.display = 'none';
}

function resetComposerHeight() {
    inputBox.style.height = `${DEFAULT_INPUT_HEIGHT}px`;
}

function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentKind(file) {
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return 'image';
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';
    if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || name.endsWith('.pptx')) return 'pptx';
    return 'unsupported';
}

function showAttachmentError(message) {
    if (!attachmentError) return;
    if (!message) {
        attachmentError.hidden = true;
        attachmentError.textContent = '';
        return;
    }

    attachmentError.textContent = message;
    attachmentError.hidden = false;
    clearTimeout(showAttachmentError.hideTimer);
    showAttachmentError.hideTimer = setTimeout(() => {
        attachmentError.hidden = true;
        attachmentError.textContent = '';
    }, 3500);
}

function clearAttachments() {
    attachedFiles.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    });
    attachedFiles = [];
    if (attachmentInput) attachmentInput.value = '';
    renderAttachmentTray();
}

function createAttachmentChip(entry, variant = 'composer') {
    const chip = document.createElement('div');
    chip.className = `attachment-chip${entry.kind === 'image' ? ' attachment-chip--image' : ''}${variant === 'bubble' ? ' attachment-chip--bubble' : ''}`;

    if (variant === 'composer' && entry.kind === 'image' && entry.previewUrl) {
        const preview = document.createElement('img');
        preview.className = 'attachment-preview';
        preview.src = entry.previewUrl;
        preview.alt = entry.file.name;
        chip.appendChild(preview);
    } else {
        const icon = document.createElement('div');
        icon.className = 'attachment-icon';
        if (entry.kind === 'pdf') {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z" /><path d="M17 18h2" /><path d="M20 15h-3v6" /></svg>';
            icon.classList.add('attachment-icon--pdf');
        } else if (entry.kind === 'image') {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><path d="M11 11l4 4"/></svg>';
            icon.classList.add('attachment-icon--image');
        } else if (entry.kind === 'docx') {
            icon.innerHTML = '<i class="ti ti-file-type-doc" aria-hidden="true"></i>';
            icon.classList.add('attachment-icon--docx');
        } else {
            icon.innerHTML = '<i class="ti ti-file-type-ppt" aria-hidden="true"></i>';
            icon.classList.add('attachment-icon--ppt');
        }
        chip.appendChild(icon);
    }

    const meta = document.createElement('div');
    meta.className = 'attachment-meta';

    const name = document.createElement('div');
    name.className = 'attachment-name';
    name.textContent = entry.file.name;

    const size = document.createElement('div');
    size.className = 'attachment-size';
    size.textContent = formatFileSize(entry.file.size);

    meta.appendChild(name);
    meta.appendChild(size);
    chip.appendChild(meta);

    if (variant === 'composer') {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'attachment-remove';
        removeBtn.setAttribute('aria-label', `Remove ${entry.file.name}`);
        removeBtn.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
        removeBtn.addEventListener('click', () => removeAttachment(entry.id));
        chip.appendChild(removeBtn);
    }

    return chip;
}

function removeAttachment(id) {
    const next = [];
    attachedFiles.forEach((entry) => {
        if (entry.id === id) {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            return;
        }
        next.push(entry);
    });
    attachedFiles = next;
    renderAttachmentTray();
}

function addAttachments(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const remainingSlots = 5 - attachedFiles.length;
    if (remainingSlots <= 0) {
        showAttachmentError('You can attach up to 5 files at a time.');
        return;
    }

    const accepted = [];
    let hitLimit = false;
    for (const file of files) {
        if (accepted.length >= remainingSlots) {
            hitLimit = true;
            break;
        }

        const kind = getAttachmentKind(file);
        if (kind === 'unsupported') {
            showAttachmentError(`Unsupported file type: ${file.name}`);
            continue;
        }

        if (file.size > 10 * 1024 * 1024) {
            showAttachmentError(`${file.name} is larger than 10 MB.`);
            continue;
        }

        const duplicate = attachedFiles.some((entry) =>
            entry.file.name === file.name &&
            entry.file.size === file.size &&
            entry.file.lastModified === file.lastModified
        ) || accepted.some((entry) =>
            entry.file.name === file.name &&
            entry.file.size === file.size &&
            entry.file.lastModified === file.lastModified
        );

        if (duplicate) continue;

        accepted.push({
            id: ++attachmentIdCounter,
            file,
            kind,
            previewUrl: kind === 'image' ? URL.createObjectURL(file) : '',
        });
    }

    if (!accepted.length) return;

    attachedFiles = attachedFiles.concat(accepted).slice(0, 5);
    renderAttachmentTray();

    if (hitLimit) {
        showAttachmentError(`You can attach up to 5 files at a time.`);
    }
}

function renderAttachmentTray() {
    if (!attachmentTray) return;

    attachmentTray.innerHTML = '';

    if (!attachedFiles.length) {
        attachmentTray.hidden = true;
        showAttachmentError('');
        return;
    }

    attachmentTray.hidden = false;
    showAttachmentError('');

    attachedFiles.forEach((entry) => {
        attachmentTray.appendChild(createAttachmentChip(entry, 'composer'));
    });
}

function buildUserBubbleText(text, attachments) {
    const message = text.trim();
    if (message) return message;

    if (attachments.length) return `Attached ${attachments.length} file${attachments.length === 1 ? '' : 's'}`;

    return '';
}

function appendBubble(text, role, showActions = true, displayText = text, rawText = text, attachments = []) {
    hideEmptyState();

    // 1. Create a parent wrapper for hover states
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${role}`;

    if (role === 'ai') {
        const agentHeader = document.createElement('div');
        agentHeader.className = 'ai-agent-header';
        const agentIcon = document.createElement('img');
        agentIcon.src = chrome.runtime.getURL('icons/icon400.png');
        agentIcon.className = 'ai-agent-icon';
        const agentName = document.createElement('span');
        agentName.textContent = 'Kali Agent';
        agentHeader.appendChild(agentIcon);
        agentHeader.appendChild(agentName);
        wrapper.appendChild(agentHeader);
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    bubble.dataset.rawText = rawText;
    bubble._attachments = attachments;
    bubble.innerHTML = role === 'ai' ? marked.parse(text) : '';

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

    if (role === 'user') {
        const textSpan = document.createElement('span');
        textSpan.className = 'user-bubble-text';
        textSpan.textContent = displayText;
        bubble.appendChild(textSpan);

        requestAnimationFrame(() => {
            const COLLAPSE_LIMIT = 168;
            if (textSpan.scrollHeight > COLLAPSE_LIMIT) {
                bubble.classList.add('has-show-more');
                textSpan.classList.add('is-collapsed');

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'show-more-btn';
                toggleBtn.innerHTML = `<span>Show more</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>`;

                toggleBtn.addEventListener('click', () => {
                    const collapsed = textSpan.classList.toggle('is-collapsed');
                    toggleBtn.classList.toggle('is-expanded', !collapsed);
                    toggleBtn.querySelector('span').textContent = collapsed ? 'Show more' : 'Show less';
                });

                bubble.appendChild(toggleBtn);
            }
        });
    }

    wrapper.appendChild(bubble);

    if (role === 'user' && attachments.length) {
        const attachmentRow = document.createElement('div');
        attachmentRow.className = 'message-attachments';
        attachments.forEach((entry) => {
            attachmentRow.appendChild(createAttachmentChip(entry, 'bubble'));
        });
        wrapper.appendChild(attachmentRow);
    }

    if (showActions) {
        const actions = document.createElement('div');
        actions.className = 'bubble-actions';

        actions.innerHTML = role === 'user'
            ? `<button title="Edit" aria-label="Edit">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <path d="M9 7h-3a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-3" />
                       <path d="M9 15h3l8.5 -8.5a1.5 1.5 0 0 0 -3 -3l-8.5 8.5v3" />
                       <path d="M16 5l3 3" />
                   </svg>
               </button>
               <button title="Copy" aria-label="Copy">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <rect x="9" y="9" width="13" height="13" rx="2.5" ry="2.5"></rect>
                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                   </svg>
               </button>`
            : `<button title="Copy" aria-label="Copy">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <rect x="9" y="9" width="13" height="13" rx="2.5" ry="2.5"></rect>
                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                   </svg>
               </button>
               <button title="Like" aria-label="Like">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                   </svg>
               </button>
               <button title="Dislike" aria-label="Dislike">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                   </svg>
               </button>
               <button title="Retry" aria-label="Retry">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                       <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                       <path d="M21 3v5h-5"></path>
                       <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                       <path d="M3 21v-5h5"></path>
                   </svg>
               </button>`;

        actions.querySelector('[title="Copy"]').addEventListener('click', (e) => {
            navigator.clipboard.writeText(bubble.dataset.rawText || text);
            const btn = e.currentTarget;
            const svg = btn.querySelector('svg');
            const originalHTML = svg.innerHTML;
            svg.innerHTML = '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>';
            svg.style.stroke = '#22c55e';
            setTimeout(() => {
                svg.innerHTML = originalHTML;
                svg.style.stroke = '';
            }, 1500);
        });

        if (role === 'user') {
            const editBtn = actions.querySelector('[title="Edit"]');

            if (isAiResponding) editBtn.classList.add('disabled');

            editBtn.addEventListener('click', () => {
                if (isAiResponding) return;

                actions.style.display = 'none';
                const currentText = bubble.dataset.rawText || bubble.textContent;
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
                        <button class="edit-btn edit-btn-cancel">Cancel</button>
                        <button class="edit-btn edit-btn-save">Save & Send</button>
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

                const restoreBubble = (nextText) => {
                    bubble.classList.remove('chat-bubble--editing');
                    bubble.style.width = '';
                    bubble.style.maxWidth = role === 'user' ? '80%' : '95%';
                    delete bubble.dataset.editWidth;
                    bubble.innerHTML = '';
                    bubble.textContent = nextText;
                    bubble.dataset.rawText = nextText;
                    actions.style.display = 'flex';
                };

                editContainer.querySelector('.edit-btn-cancel').addEventListener('click', () => {
                    restoreBubble(currentText);
                });

                editContainer.querySelector('.edit-btn-save').addEventListener('click', () => {
                    const newText = textarea.value.trim();
                    const originalAttachments = bubble._attachments || [];
                    if (!newText && !originalAttachments.length) return;

                    restoreBubble(newText);

                    let next = wrapper.nextElementSibling;
                    while (next) {
                        const temp = next;
                        next = next.nextElementSibling;
                        temp.remove();
                    }

                    processAiResponse({ text: newText, attachments: originalAttachments });
                });
            });
        }

        if (role === 'ai') {
            actions.querySelector('[title="Like"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(75, 63, 216)';
                btn.style.color = isActive ? '' : '#4b3fd8';
                actions.querySelector('[title="Dislike"]').style.color = '';
            });

            actions.querySelector('[title="Dislike"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(239, 68, 68)';
                btn.style.color = isActive ? '' : '#ef4444';
                actions.querySelector('[title="Like"]').style.color = '';
            });

            actions.querySelector('[title="Retry"]').addEventListener('click', (e) => {
                const svg = e.currentTarget.querySelector('svg');
                svg.classList.add('spin-once');
                svg.addEventListener('animationend', () => svg.classList.remove('spin-once'), { once: true });

                const userBubbles = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserBubble = userBubbles[userBubbles.length - 1];
                const lastUserText = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;

                if (lastUserText) {
                    thinkingBubble.parentNode.remove();
                    lastUserBubble.parentNode.remove();
                    const lastUserAttachments = lastUserBubble._attachments || [];
                    appendBubble(lastUserText, 'user', true, lastUserText, lastUserText, lastUserAttachments);
                    processAiResponse({ text: lastUserText, attachments: lastUserAttachments });
                }
            });
        }

        wrapper.appendChild(actions);
    }

    chatArea.appendChild(wrapper);
    chatArea.scrollTop = chatArea.scrollHeight;
    return bubble;
}

function typeText(element, text, speed = 6, signal = null) {
    element.innerHTML = '';
    let i = 0;
    return new Promise((resolve) => {
        function type() {
            if (signal && signal.aborted) {
                element.innerHTML = marked.parse(text.slice(0, i));
                element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
                if (!userHasScrolledUp) chatArea.scrollTop = chatArea.scrollHeight;
                return resolve();
            }

            if (i < text.length) {
                i = Math.min(i + 5, text.length);
                element.innerHTML = marked.parse(text.slice(0, i));
                if (!userHasScrolledUp) chatArea.scrollTop = chatArea.scrollHeight;
                setTimeout(type, speed);
            } else {
                element.innerHTML = marked.parse(text);
                element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
                if (!userHasScrolledUp) chatArea.scrollTop = chatArea.scrollHeight;
                resolve();
            }
        }
        type();
    });
}

// ── Features ─────────────────────────────────────────────────────

function updateResizeCursor(e) {
    if (isResizing) return;
    const isTopEdge = e.clientY - inputWrapper.getBoundingClientRect().top < 8;
    const cursor = isTopEdge ? 'ns-resize' : 'text';
    inputWrapper.style.cursor = cursor;
    inputBox.style.cursor = cursor;
}

function tryStartResize(e) {
    const isTopEdge = e.clientY - inputWrapper.getBoundingClientRect().top < 8;
    if (isTopEdge) {
        isResizing = true;
        startY = e.clientY;
        startHeight = inputBox.getBoundingClientRect().height;
        e.preventDefault();
    }
}

async function sendMessage() {
    userHasScrolledUp = false;
    const text = inputBox.value.trim();
    const attachments = attachedFiles.slice();
    if (!text && !attachments.length) return;

    inputBox.value = '';
    resetComposerHeight();

    const displayText = buildUserBubbleText(text, attachments);
    const rawText = text.trim() || displayText;
    appendBubble(displayText, 'user', true, displayText, rawText, attachments);

    // Keep the composer clean while the request is in flight.
    clearAttachments();

    const success = await processAiResponse({
        text,
        attachments,
    });
}

async function processAiResponse({ text, attachments = [] }) {
    isAiResponding = true;
    abortController = new AbortController();

    setSendButtonState(true);

    document.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach(btn => {
        btn.classList.add('disabled');
    });

    const thinkingBubble = appendBubble('', 'ai', false);
    let phraseIndex = 0;

    function renderPhrase() {
        thinkingBubble.innerHTML = '';
        const wrapper = document.createElement('span');
        wrapper.className = 'phrase-wrapper';
        const shimmer = document.createElement('span');
        shimmer.className = 'shimmer-text';
        shimmer.textContent = THINKING_PHRASES[phraseIndex];
        wrapper.appendChild(shimmer);
        thinkingBubble.appendChild(wrapper);
    }

    renderPhrase();
    const thinkingInterval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % THINKING_PHRASES.length;
        renderPhrase();
    }, 2000);

    try {
        const hasAttachments = attachments.length > 0;
        let response;

        if (hasAttachments) {
            const formData = new FormData();
            formData.append('message', text);
            formData.append('model', currentModel);
            attachments.forEach((entry) => {
                formData.append('attachments', entry.file, entry.file.name);
            });

            response = await fetch(BACKEND_URL, {
                method: 'POST',
                body: formData,
                signal: abortController.signal,
            });
        } else {
            response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, model: currentModel }),
                signal: abortController.signal
            });
        }

        const data = await response.json();
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';

        if (!response.ok || data.error) {
            thinkingBubble.textContent = `⚠️ ${data.error || 'Server error'}`;
            return false;
        } else {
            thinkingBubble.dataset.rawText = data.reply;
            await typeText(thinkingBubble, data.reply, 1, abortController.signal);

            const actions = document.createElement('div');
            actions.className = 'bubble-actions';
            actions.innerHTML = `
                <button title="Copy" aria-label="Copy">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2.5" ry="2.5"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
                <button title="Like" aria-label="Like">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                    </svg>
                </button>
                <button title="Dislike" aria-label="Dislike">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                    </svg>
                </button>
                <button title="Retry" aria-label="Retry">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                        <path d="M21 3v5h-5"></path>
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                        <path d="M3 21v-5h5"></path>
                    </svg>
                </button>`;

            actions.querySelector('[title="Copy"]').addEventListener('click', (e) => {
                navigator.clipboard.writeText(thinkingBubble.dataset.rawText || thinkingBubble.textContent);
                const btn = e.currentTarget;
                const svg = btn.querySelector('svg');
                const originalHTML = svg.innerHTML;
                svg.innerHTML = '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>';
                svg.style.stroke = '#22c55e';
                setTimeout(() => {
                    svg.innerHTML = originalHTML;
                    svg.style.stroke = '';
                }, 1500);
            });

            actions.querySelector('[title="Like"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(75, 63, 216)';
                btn.style.color = isActive ? '' : '#4b3fd8';
                actions.querySelector('[title="Dislike"]').style.color = '';
            });

            actions.querySelector('[title="Dislike"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(239, 68, 68)';
                btn.style.color = isActive ? '' : '#ef4444';
                actions.querySelector('[title="Like"]').style.color = '';
            });

            actions.querySelector('[title="Retry"]').addEventListener('click', (e) => {
                const svg = e.currentTarget.querySelector('svg');
                svg.classList.add('spin-once');
                svg.addEventListener('animationend', () => svg.classList.remove('spin-once'), { once: true });

                const userBubbles = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserBubble = userBubbles[userBubbles.length - 1];
                const lastUserText = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;

                if (lastUserText) {
                    thinkingBubble.parentNode.remove();
                    lastUserBubble.parentNode.remove();
                    const lastUserAttachments = lastUserBubble._attachments || [];
                    appendBubble(lastUserText, 'user', true, lastUserText, lastUserText, lastUserAttachments);
                    processAiResponse({ text: lastUserText, attachments: lastUserAttachments });
                }
            });

            thinkingBubble.parentNode.appendChild(actions);
            chatArea.scrollTop = chatArea.scrollHeight;
            return true;
        }
    } catch (err) {
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';
        if (err.name === 'AbortError') {
            thinkingBubble.textContent = '⚠️ Generation stopped.';
        } else {
            thinkingBubble.textContent = '⚠️ Could not reach the backend. Is server.py running?';
            console.error('[Kali Agent] Fetch error:', err);
        }
        return false;
    } finally {
        isAiResponding = false;
        setSendButtonState(false);
        document.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach(btn => {
            btn.classList.remove('disabled');
        });
    }
}

function handleModelSelect(option) {
    currentModel = option.getAttribute('data-model');
    selectedModelText.textContent = option.textContent.trim();
    modelDropdown.style.display = 'none';

    const mainDot = modelSelectBtn.querySelector('.model-dot');
    const optionDot = option.querySelector('.model-dot');
    if (mainDot && optionDot) mainDot.style.background = optionDot.style.background;
}

// ── Event Listeners ──────────────────────────────────────────────

inputBox.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

inputBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isAiResponding) sendMessage();
    }
});

if (attachmentInput) {
    attachmentInput.addEventListener('change', (e) => {
        addAttachments(e.target.files);
        e.target.value = '';
    });
}

const plusBtn = document.querySelector('.plus-btn');
if (plusBtn) {
    plusBtn.addEventListener('click', () => {
        if (isAiResponding) return;
        showAttachmentError('');
        attachmentInput?.click();
    });
}

try {
    document.querySelector('.header-actions .icon-btn[aria-label="New chat"]').addEventListener('click', () => {
        if (isAiResponding) return;
        renderEmptyState();
        inputBox.value = '';
        resetComposerHeight();
        clearAttachments();
        fetch(RESET_URL, { method: 'POST' }).catch(() => { });
        isAiResponding = false;
    });
} catch (e) { }

try {
    document.querySelector('.header-actions .icon-btn[aria-label="Export"]').addEventListener('click', () => {
        const messages = [];
        document.querySelectorAll('.chat-bubble').forEach(bubble => {
            messages.push(bubble.dataset.rawText || bubble.textContent);
        });
        const blob = new Blob([messages.join('\n\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-export.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
} catch (e) { }

try {
    const sidebarToggleBtn = document.querySelector('.header-actions .icon-btn[aria-label="Toggle sidebar"]');
    sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebarShell.classList.toggle('sidebar-collapsed');
        sidebarToggleBtn.setAttribute('aria-pressed', String(isCollapsed));
        sidebarToggleBtn.setAttribute('data-tooltip', isCollapsed ? 'Show sidebar' : 'Hide sidebar');
    });
} catch (e) { }

// ── Navigation Items Event Listeners ─────────────────────────────
function setActive(element) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    // Add active class to clicked element
    element.classList.add('active');
}

const navItems = document.querySelectorAll('.nav-item[data-nav-item]');
navItems.forEach(item => {
    item.addEventListener('click', function() {
        setActive(this);
    });
    
    // Support keyboard navigation
    item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActive(this);
        }
    });
});

inputWrapper.addEventListener('mousemove', updateResizeCursor);
inputBox.addEventListener('mousemove', updateResizeCursor);

inputWrapper.addEventListener('mousedown', tryStartResize);
inputBox.addEventListener('mousedown', tryStartResize);

document.addEventListener('mousemove', function (e) {
    if (!isResizing) return;
    const newHeight = Math.min(400, Math.max(100, startHeight + (startY - e.clientY)));
    inputBox.style.height = newHeight + 'px';
});

document.addEventListener('mouseup', () => { isResizing = false; });

sendBtn?.addEventListener('click', () => {
    if (isAiResponding) {
        if (abortController) abortController.abort(); // Stop generating
    } else {
        sendMessage(); // Send message
    }
});

modelSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modelDropdown.style.display = modelDropdown.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', (e) => {
    if (!modelDropdown.contains(e.target) && !modelSelectBtn.contains(e.target)) {
        modelDropdown.style.display = 'none';
    }
});

modelOptions.forEach(option => option.addEventListener('click', () => handleModelSelect(option)));

resetComposerHeight();
renderEmptyState();
