// Inject custom styles for shimmer and bubble animations dynamically
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
                #52525b 0%,
                #52525b 20%,
                #f4f4f5 45%,
                #09090b 50%,
                #f4f4f5 55%,
                #52525b 80%,
                #52525b 100%
            );
            background-size: 400% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: textShimmer 1.8s ease-in-out infinite;
        }
        @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
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
        .model-option:hover {
            background: #f3f4f6;
        }
    `;
    document.head.appendChild(style);
})();

const inputBox = document.querySelector('.input-box');
const inputWrapper = document.querySelector('.input-box-wrapper');
let isResizing = false;
let startY = 0;
let startHeight = 0;

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

function updateResizeCursor(e) {
    if (isResizing) return;
    const rect = inputWrapper.getBoundingClientRect();
    const isTopEdge = e.clientY - rect.top < 8;
    const cursor = isTopEdge ? 'ns-resize' : 'text';
    inputWrapper.style.cursor = cursor;
    inputBox.style.cursor = cursor;
}

function tryStartResize(e) {
    const rect = inputWrapper.getBoundingClientRect();
    const isTopEdge = e.clientY - rect.top < 8;

    if (isTopEdge) {
        isResizing = true;
        startY = e.clientY;
        startHeight = inputBox.getBoundingClientRect().height;
        e.preventDefault();
    }
}

inputWrapper.addEventListener('mousemove', updateResizeCursor);
inputBox.addEventListener('mousemove', updateResizeCursor);

inputWrapper.addEventListener('mousedown', tryStartResize);
inputBox.addEventListener('mousedown', tryStartResize);

document.addEventListener('mousemove', function (e) {
    if (!isResizing) return;

    const delta = startY - e.clientY;
    let newHeight = startHeight + delta;
    const minHeight = 100;
    const maxHeight = 400;

    if (newHeight < minHeight) newHeight = minHeight;
    if (newHeight > maxHeight) newHeight = maxHeight;

    inputBox.style.height = newHeight + 'px';
});

document.addEventListener('mouseup', function () {
    isResizing = false;
});

// ── Chat rendering helpers ───────────────────────────────────────

const chatArea = document.querySelector('.chat-area');
const emptyState = document.querySelector('.empty-state');

/**
 * Appends a chat bubble to the chat area.
 * @param {string} text   - The message text
 * @param {'user'|'ai'} role - Who sent the message
 * @returns {HTMLElement} The created bubble element
 */
function appendBubble(text, role) {
    // Hide empty-state illustration on first message
    if (emptyState) emptyState.style.display = 'none';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    bubble.textContent = text;

    // Inline styles keep us fully decoupled from popup.css changes
    Object.assign(bubble.style, {
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        marginBottom: '10px',
        lineHeight: '1.5',
        fontSize: '14px',
        wordBreak: 'break-word',
        alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
        background: role === 'user'
            ? 'linear-gradient(135deg, #6073ea, #4b3fd8)'
            : '#f3f4f6',
        color: role === 'user' ? '#fff' : '#111111',
        border: role === 'ai' ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
    });

    // Make chat area a flex column if not already
    Object.assign(chatArea.style, {
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        overflowY: 'auto',
    });

    chatArea.appendChild(bubble);
    chatArea.scrollTop = chatArea.scrollHeight;
    return bubble;
}

// ── Send message to Python backend ──────────────────────────────

const BACKEND_URL = 'http://localhost:5000/chat';

/**
 * Types text into an element character by character at a set speed.
 * @param {HTMLElement} element - The target element
 * @param {string} text - The text to type
 * @param {number} speed - Delay per character in milliseconds
 * @returns {Promise<void>}
 */
function typeText(element, text, speed = 6) {
    element.textContent = '';
    let i = 0;
    return new Promise((resolve) => {
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                chatArea.scrollTop = chatArea.scrollHeight;
                setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

async function sendMessage() {
    const text = inputBox.value.trim();
    if (!text) return;

    // Clear input immediately
    inputBox.value = '';
    inputBox.style.height = '100px';

    // Show user bubble
    appendBubble(text, 'user');

    // Show a thinking indicator with cycling shimmer phrases
    const thinkingBubble = appendBubble('', 'ai');

    const phrases = [
        "Thinking...",
        "Processing...",
        "Analyzing...",
        "Generating...",
        "Almost there..."
    ];
    let phraseIndex = 0;

    function renderPhrase() {
        thinkingBubble.innerHTML = '';
        // Outer span: handles the slide-up transform
        const wrapper = document.createElement('span');
        wrapper.className = 'phrase-wrapper';
        // Inner span: handles the shimmer background-clip
        const shimmer = document.createElement('span');
        shimmer.className = 'shimmer-text';
        shimmer.textContent = phrases[phraseIndex];
        wrapper.appendChild(shimmer);
        thinkingBubble.appendChild(wrapper);
    }

    renderPhrase();
    const thinkingInterval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        renderPhrase();
    }, 2000);

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model: currentModel }),
        });

        const data = await response.json();

        // Stop cycling and prepare bubble for response
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';

        if (!response.ok || data.error) {
            thinkingBubble.textContent = `⚠️ ${data.error || 'Server error'}`;
        } else {
            // Type the AI reply quickly
            await typeText(thinkingBubble, data.reply, 6);
        }
    } catch (err) {
        clearInterval(thinkingInterval);
        thinkingBubble.innerHTML = '';
        thinkingBubble.textContent =
            '⚠️ Could not reach the backend. Is server.py running? (python server.py)';
        console.error('[Kali Agent] Fetch error:', err);
    }
}

// Wire the send button click to sendMessage
document.querySelector('.send-btn').addEventListener('click', sendMessage);

// ── Model Selector Dropdown Logic ──────────────────────────────
let currentModel = 'gemini-2.5-flash';

const modelSelectBtn = document.getElementById('modelSelectBtn');
const modelDropdown = document.getElementById('modelDropdown');
const selectedModelText = document.getElementById('selectedModelText');
const modelOptions = document.querySelectorAll('.model-option');

// Toggle dropdown
modelSelectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = modelDropdown.style.display === 'block';
    modelDropdown.style.display = isVisible ? 'none' : 'block';
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!modelDropdown.contains(e.target)) {
        modelDropdown.style.display = 'none';
    }
});

// Handle option selection
modelOptions.forEach(option => {
    option.addEventListener('click', () => {
        currentModel = option.getAttribute('data-model');
        selectedModelText.textContent = option.textContent.trim();
        modelDropdown.style.display = 'none';
        
        // Update the main button's dot color to match the selected option
        const mainDot = modelSelectBtn.querySelector('.model-dot');
        const optionDot = option.querySelector('.model-dot');
        if (mainDot && optionDot) {
            mainDot.style.background = optionDot.style.background;
        }
    });
});