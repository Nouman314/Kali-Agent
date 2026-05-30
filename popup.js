// Inject custom styles for shimmer and bubble animations dynamically
(function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes textShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .shimmer-text {
            display: inline-block;
            background: linear-gradient(90deg, #71717a 20%, #09090b 50%, #71717a 80%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: textShimmer 2s linear infinite;
        }
        @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .chat-bubble {
            animation: bubbleFadeIn 0.25s ease-out forwards;
        }
        @keyframes phraseSlideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .phrase-animate {
            animation: phraseSlideUp 0.3s ease-out forwards;
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

    // Show a thinking indicator with cycling phrases
    const thinkingBubble = appendBubble('', 'ai');
    const shimmerSpan = document.createElement('span');
    shimmerSpan.className = 'shimmer-text phrase-animate';
    thinkingBubble.appendChild(shimmerSpan);

    const phrases = [
        "Agent is thinking...",
        "Processing your request...",
        "Analyzing the data...",
        "Generating response...",
        "Almost there..."
    ];
    let phraseIndex = 0;
    shimmerSpan.textContent = phrases[0];

    const thinkingInterval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        shimmerSpan.textContent = phrases[phraseIndex];
        
        // Restart animation
        shimmerSpan.classList.remove('phrase-animate');
        void shimmerSpan.offsetWidth; // Trigger reflow
        shimmerSpan.classList.add('phrase-animate');
    }, 3000);

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
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