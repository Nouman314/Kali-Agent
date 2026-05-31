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
let currentModel  = 'gemini-2.5-flash';

const THINKING_PHRASES = [
    'Thinking...', 'Processing...', 'Analyzing...',
    'Generating...', 'Almost there...'
];

// ── DOM References ───────────────────────────────────────────────
const inputBox          = document.querySelector('.input-box');
const inputWrapper      = document.querySelector('.input-box-wrapper');
const chatArea          = document.querySelector('.chat-area');
const emptyState        = document.querySelector('.empty-state');
const modelSelectBtn    = document.getElementById('modelSelectBtn');
const modelDropdown     = document.getElementById('modelDropdown');
const selectedModelText = document.getElementById('selectedModelText');
const modelOptions      = document.querySelectorAll('.model-option');

// ── Resize State ─────────────────────────────────────────────────
let isResizing  = false;
let startY      = 0;
let startHeight = 0;

// ── Helpers ──────────────────────────────────────────────────────

// showActions = false is used for the thinking bubble so icons don't appear before a real reply
function appendBubble(text, role, showActions = true) {
    if (emptyState) emptyState.style.display = 'none';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    bubble.dataset.rawText = role === 'ai' ? text : '';
    bubble.innerHTML = role === 'ai' ? marked.parse(text) : text;

    Object.assign(bubble.style, {
        maxWidth:     role === 'user' ? '80%' : '95%',
        padding:      '10px 14px',
        borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        marginBottom: '10px',
        lineHeight:   '1.5',
        fontSize:     '14px',
        wordBreak:    'break-word',
        alignSelf:    role === 'user' ? 'flex-end' : 'flex-start',
        background:   role === 'user' ? 'linear-gradient(135deg, #6073ea, #4b3fd8)' : '#f3f4f6',
        color:        role === 'user' ? '#fff' : '#111111',
        border:       role === 'ai'   ? '1px solid rgba(0,0,0,0.08)' : 'none',
    });

    // Ensure chat area is a flex column (decoupled from popup.css)
    Object.assign(chatArea.style, {
        display:       'flex',
        flexDirection: 'column',
        padding:       '16px',
        overflowY:     'auto',
    });

    chatArea.appendChild(bubble);

    if (showActions) {
        const actions = document.createElement('div');
        actions.className       = 'bubble-actions';
        actions.style.alignSelf = role === 'user' ? 'flex-end' : 'flex-start';

        actions.innerHTML = role === 'user'
            ? `<button title="Edit"><i class="ti ti-edit"></i></button>
               <button title="Copy"><i class="ti ti-copy"></i></button>`
            : `<button title="Copy"><i class="ti ti-copy"></i></button>
               <button title="Like"><i class="ti ti-thumb-up"></i></button>
               <button title="Dislike"><i class="ti ti-thumb-down"></i></button>
               <button title="Retry"><i class="ti ti-refresh"></i></button>`;

        // Copy works for both roles
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
            actions.querySelector('[title="Edit"]').addEventListener('click', () => {
                inputBox.value = text;
                inputBox.focus();
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
                const userBubbles  = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserText = userBubbles[userBubbles.length - 1]?.textContent;
                if (lastUserText) {
                    inputBox.value = lastUserText;
                    sendMessage();
                }
            });
        }

        chatArea.appendChild(actions);
    }

    chatArea.scrollTop = chatArea.scrollHeight;
    return bubble;
}

function typeText(element, text, speed = 6) {
    element.innerHTML = '';
    let i = 0;
    return new Promise((resolve) => {
        function type() {
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

    inputBox.value        = '';
    inputBox.style.height = '100px';

    appendBubble(text, 'user');

    // Pass false so the thinking bubble gets no action icons
    const thinkingBubble = appendBubble('', 'ai', false);
    let phraseIndex = 0;

    // Cycles through shimmer phrases while waiting for the backend response
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
        });

        const data = await response.json();
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';

        if (!response.ok || data.error) {
            thinkingBubble.textContent = `⚠️ ${data.error || 'Server error'}`;
        } else {
            thinkingBubble.dataset.rawText = data.reply;
            await typeText(thinkingBubble, data.reply, 6);

            // Add action icons after the reply has finished typing
            const actions = document.createElement('div');
            actions.className       = 'bubble-actions';
            actions.style.alignSelf = 'flex-start';
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
                const userBubbles   = chatArea.querySelectorAll('.chat-bubble--user');
                const lastUserText  = userBubbles[userBubbles.length - 1]?.textContent;
                if (lastUserText) {
                    inputBox.value = lastUserText;
                    sendMessage();
                }
            });

            chatArea.appendChild(actions);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    } catch (err) {
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML   = '';
        thinkingBubble.textContent = '⚠️ Could not reach the backend. Is server.py running? (python server.py)';
        console.error('[Kali Agent] Fetch error:', err);
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
        sendMessage();
    }
});

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

document.querySelector('.send-btn').addEventListener('click', sendMessage);

modelSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modelDropdown.style.display = modelDropdown.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', (e) => {
    if (!modelDropdown.contains(e.target)) modelDropdown.style.display = 'none';
});

modelOptions.forEach(option => option.addEventListener('click', () => handleModelSelect(option)));