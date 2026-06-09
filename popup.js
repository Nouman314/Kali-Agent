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
let currentModel  = 'gemini-3.1-flash-lite';
let isAiResponding = false;
let abortController = null;

const THINKING_PHRASES = [
    'Thinking...', 'Processing...', 'Analyzing...',
    'Generating...', 'Almost there...'
];

const DEFAULT_INPUT_HEIGHT = 100;

// ── DOM References ───────────────────────────────────────────────
const inputBox          = document.querySelector('.input-box');
const inputWrapper      = document.querySelector('.input-box-wrapper');
const chatArea          = document.querySelector('.chat-area');
const emptyStateTemplate = document.getElementById('emptyStateTemplate');
const EMPTY_STATE_HTML   = emptyStateTemplate ? emptyStateTemplate.innerHTML.trim() : '';
const modelSelectBtn    = document.getElementById('modelSelectBtn');
const modelDropdown     = document.getElementById('modelDropdown');
const selectedModelText = document.getElementById('selectedModelText');
const modelOptions      = document.querySelectorAll('.model-option');
const sidebarShell      = document.querySelector('.sidebar-shell');

// ── Resize State ─────────────────────────────────────────────────
let isResizing  = false;
let startY      = 0;
let startHeight = 0;

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

function appendBubble(text, role, showActions = true) {
    hideEmptyState();

    // 1. Create a parent wrapper for hover states
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper message-wrapper--${role}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    bubble.dataset.rawText = text;
    bubble.innerHTML = role === 'ai' ? marked.parse(text) : text;

    Object.assign(bubble.style, {
        maxWidth:     role === 'user' ? '80%' : '95%',
        padding:      '10px 14px',
        borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        marginBottom: '4px',
        lineHeight:   '1.5',
        fontSize:     '14px',
        wordBreak:    'break-word',
        background:   role === 'user' ? 'linear-gradient(135deg, #6073ea, #4b3fd8)' : '#f3f4f6',
        color:        role === 'user' ? '#fff' : '#111111',
        border:       role === 'ai'   ? '1px solid rgba(0,0,0,0.08)' : 'none',
    });

    wrapper.appendChild(bubble);

    if (showActions) {
        const actions = document.createElement('div');
        actions.className = 'bubble-actions';

        actions.innerHTML = role === 'user'
            ? `<button title="Edit"><i class="ti ti-edit"></i></button>
               <button title="Copy"><i class="ti ti-copy"></i></button>`
            : `<button title="Copy"><i class="ti ti-copy"></i></button>
               <button title="Like"><i class="ti ti-thumb-up"></i></button>
               <button title="Dislike"><i class="ti ti-thumb-down"></i></button>
               <button title="Retry"><i class="ti ti-refresh"></i></button>`;

        actions.querySelector('[title="Copy"]').addEventListener('click', (e) => {
            navigator.clipboard.writeText(bubble.dataset.rawText || text);
            const btn = e.currentTarget;
            btn.querySelector('i').className = 'ti ti-check';
            btn.style.color = '#22c55e';
            setTimeout(() => {
                btn.querySelector('i').className = 'ti ti-copy';
                btn.style.color = '';
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
                    if (!newText) return;

                    restoreBubble(newText);

                    let next = wrapper.nextElementSibling;
                    while (next) {
                        const temp = next;
                        next = next.nextElementSibling;
                        temp.remove();
                    }

                    processAiResponse(newText);
                });
            });
        }

        if (role === 'ai') {
            actions.querySelector('[title="Like"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(75, 63, 216)';
                btn.style.color = isActive ? '' : '#4b3fd8';
            });

            actions.querySelector('[title="Dislike"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(239, 68, 68)';
                btn.style.color = isActive ? '' : '#ef4444';
            });

            actions.querySelector('[title="Retry"]').addEventListener('click', (e) => {
                const icon = e.currentTarget.querySelector('i');
                icon.classList.add('spin-once');
                icon.addEventListener('animationend', () => icon.classList.remove('spin-once'), { once: true });

                const userBubbles    = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserBubble = userBubbles[userBubbles.length - 1];
                const lastUserText   = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;

                if (lastUserText) {
                    thinkingBubble.parentNode.remove();
                    lastUserBubble.parentNode.remove();
                    appendBubble(lastUserText, 'user');
                    processAiResponse(lastUserText);
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
                chatArea.scrollTop = chatArea.scrollHeight;
                return resolve();
            }

            if (i < text.length) {
                i++;
                element.innerHTML = marked.parse(text.slice(0, i));
                chatArea.scrollTop = chatArea.scrollHeight;
                setTimeout(type, speed);
            } else {
                element.innerHTML = marked.parse(text);
                element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
                chatArea.scrollTop = chatArea.scrollHeight;
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
    inputBox.style.cursor     = cursor;
}

function tryStartResize(e) {
    const isTopEdge = e.clientY - inputWrapper.getBoundingClientRect().top < 8;
    if (isTopEdge) {
        isResizing  = true;
        startY      = e.clientY;
        startHeight = inputBox.getBoundingClientRect().height;
        e.preventDefault();
    }
}

async function sendMessage() {
    const text = inputBox.value.trim();
    if (!text) return;

    inputBox.value = '';
    resetComposerHeight();

    appendBubble(text, 'user');
    await processAiResponse(text);
}

async function processAiResponse(text) {
    isAiResponding = true;
    abortController = new AbortController();

    const sendBtnIcon = document.querySelector('.send-btn i');
    if (sendBtnIcon) sendBtnIcon.className = 'ti ti-square-filled';

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
        shimmer.className   = 'shimmer-text';
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
        const response = await fetch(BACKEND_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ message: text, model: currentModel }),
            signal:  abortController.signal
        });

        const data = await response.json();
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';

        if (!response.ok || data.error) {
            thinkingBubble.textContent = `⚠️ ${data.error || 'Server error'}`;
        } else {
            thinkingBubble.dataset.rawText = data.reply;
            await typeText(thinkingBubble, data.reply, 6, abortController.signal);

            const actions = document.createElement('div');
            actions.className = 'bubble-actions';
            actions.innerHTML = `
                <button title="Copy"><i class="ti ti-copy"></i></button>
                <button title="Like"><i class="ti ti-thumb-up"></i></button>
                <button title="Dislike"><i class="ti ti-thumb-down"></i></button>
                <button title="Retry"><i class="ti ti-refresh"></i></button>`;

            actions.querySelector('[title="Copy"]').addEventListener('click', (e) => {
                navigator.clipboard.writeText(thinkingBubble.dataset.rawText || thinkingBubble.textContent);
                const btn = e.currentTarget;
                btn.querySelector('i').className = 'ti ti-check';
                btn.style.color = '#22c55e';
                setTimeout(() => {
                    btn.querySelector('i').className = 'ti ti-copy';
                    btn.style.color = '';
                }, 1500);
            });

            actions.querySelector('[title="Like"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(75, 63, 216)';
                btn.style.color = isActive ? '' : '#4b3fd8';
            });

            actions.querySelector('[title="Dislike"]').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const isActive = btn.style.color === 'rgb(239, 68, 68)';
                btn.style.color = isActive ? '' : '#ef4444';
            });

            actions.querySelector('[title="Retry"]').addEventListener('click', (e) => {
                const icon = e.currentTarget.querySelector('i');
                icon.classList.add('spin-once');
                icon.addEventListener('animationend', () => icon.classList.remove('spin-once'), { once: true });

                const userBubbles    = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserBubble = userBubbles[userBubbles.length - 1];
                const lastUserText   = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;

                if (lastUserText) {
                    thinkingBubble.parentNode.remove();
                    lastUserBubble.parentNode.remove();
                    appendBubble(lastUserText, 'user');
                    processAiResponse(lastUserText);
                }
            });

            thinkingBubble.parentNode.appendChild(actions);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    } catch (err) {
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML   = '';
        if (err.name === 'AbortError') {
            thinkingBubble.textContent = '⚠️ Generation stopped.';
        } else {
            thinkingBubble.textContent = '⚠️ Could not reach the backend. Is server.py running?';
            console.error('[Kali Agent] Fetch error:', err);
        }
    } finally {
        isAiResponding = false;
        if (sendBtnIcon) sendBtnIcon.className = 'ti ti-arrow-up';
        document.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach(btn => {
            btn.classList.remove('disabled');
        });
    }
}

function handleModelSelect(option) {
    currentModel                  = option.getAttribute('data-model');
    selectedModelText.textContent = option.textContent.trim();
    modelDropdown.style.display   = 'none';

    const mainDot   = modelSelectBtn.querySelector('.model-dot');
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

try {
    document.querySelector('.header-actions .icon-btn[aria-label="New chat"]').addEventListener('click', () => {
        if (isAiResponding) return;
        renderEmptyState();
        inputBox.value = '';
        resetComposerHeight();
        isAiResponding = false;
    });
} catch(e) {}

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
} catch(e) {}

try {
    const sidebarToggleBtn = document.querySelector('.header-actions .icon-btn[aria-label="Toggle sidebar"]');
    sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebarShell.classList.toggle('sidebar-collapsed');
        sidebarToggleBtn.setAttribute('aria-pressed', String(isCollapsed));
        sidebarToggleBtn.setAttribute('data-tooltip', isCollapsed ? 'Show sidebar' : 'Hide sidebar');
    });
} catch(e) {}

inputWrapper.addEventListener('mousemove', updateResizeCursor);
inputBox.addEventListener('mousemove',     updateResizeCursor);

inputWrapper.addEventListener('mousedown', tryStartResize);
inputBox.addEventListener('mousedown',     tryStartResize);

document.addEventListener('mousemove', function (e) {
    if (!isResizing) return;
    const newHeight = Math.min(400, Math.max(100, startHeight + (startY - e.clientY)));
    inputBox.style.height = newHeight + 'px';
});

document.addEventListener('mouseup', () => { isResizing = false; });

// Find and replace your existing send-btn listener with this:
document.querySelector('.send-btn').addEventListener('click', () => {
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
