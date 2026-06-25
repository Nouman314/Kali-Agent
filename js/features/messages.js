import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { sendChatRequest } from '../services/chatApi.js';
import { clearAttachments, createAttachmentChip, buildUserBubbleText } from './attachments.js';
import { state } from '../state.js';

let chatBound = false;

function scrollChatToBottom() {
    if (!dom.chatArea || state.userHasScrolledUp) return;
    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
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

export function renderEmptyState() {
    if (!dom.chatArea || !dom.emptyStateHTML) return;
    dom.chatArea.innerHTML = dom.emptyStateHTML;
}

export function hideEmptyState() {
    const currentEmptyState = dom.chatArea?.querySelector('.empty-state');
    if (currentEmptyState) {
        currentEmptyState.style.display = 'none';
    }
}

export function resetComposerHeight() {
    if (!dom.inputBox) return;
    dom.inputBox.style.height = `${CONFIG.COMPOSER.DEFAULT_INPUT_HEIGHT}px`;
}

export function setSendButtonState(isStopping) {
    if (!dom.sendBtn || !dom.sendBtnIcon) return;

    if (isStopping) {
        dom.sendBtn.setAttribute('aria-label', 'Stop');
        dom.sendBtn.setAttribute('data-tooltip', 'Stop');
        dom.sendBtnIcon.style.transform = 'scale(1.12)';
        dom.sendBtnIcon.style.transformOrigin = 'center';
        dom.sendBtnIcon.innerHTML = '<rect x="5" y="5" width="14" height="14" rx="3.5" ry="3.5" fill="currentColor" stroke="none" />';
    } else {
        dom.sendBtn.setAttribute('aria-label', 'Send');
        dom.sendBtn.setAttribute('data-tooltip', 'Send');
        dom.sendBtnIcon.style.transform = '';
        dom.sendBtnIcon.style.transformOrigin = '';
        dom.sendBtnIcon.innerHTML = '<line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />';
    }
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

    actions.innerHTML = role === 'user'
        ? `<button type="button" title="Edit" aria-label="Edit">
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
           </button>`
        : `<button type="button" title="Copy" aria-label="Copy">
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
        </svg>`
};

function createBubbleWrapper(role, showActions = true) {
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

    bubble._wrapper = wrapper;
    return bubble;
}

export function appendBubble(text, role, showActions = true, displayText = text, rawText = text, attachments = []) {
    hideEmptyState();

    const bubble = createBubbleWrapper(role, showActions);
    const wrapper = bubble._wrapper;

    bubble.dataset.rawText = rawText;
    bubble._attachments = attachments;

    if (role === 'ai') {
        bubble.innerHTML = text ? renderMarkdown(text) : '';
    } else {
        renderUserBubbleText(bubble, displayText);
    }

    if (role === 'user' && attachments.length) {
        const attachmentRow = document.createElement('div');
        attachmentRow.className = 'message-attachments';
        attachments.forEach((entry) => {
            attachmentRow.appendChild(createAttachmentChip(entry, 'bubble'));
        });
        const actions = wrapper.querySelector('.bubble-actions');
        if (actions) {
            wrapper.insertBefore(attachmentRow, actions);
        } else {
            wrapper.appendChild(attachmentRow);
        }
    }

    dom.chatArea.appendChild(wrapper);
    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
    return bubble;
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

function toggleBubbleLike(button, bubble, activeColor, otherSelector) {
    const isActive = button.style.color === activeColor;
    button.style.color = isActive ? '' : activeColor;
    const wrapper = bubble.closest('.message-wrapper');
    const otherButton = wrapper?.querySelector(otherSelector);
    if (otherButton) otherButton.style.color = '';
}

function restoreEditableBubble(bubble, actions, text, attachments) {
    bubble.classList.remove('chat-bubble--editing');
    bubble.style.width = '';
    bubble.style.maxWidth = '80%';
    delete bubble.dataset.editWidth;
    bubble.dataset.rawText = text;
    bubble._attachments = attachments;
    renderUserBubbleText(bubble, text);
    actions.style.display = 'flex';
}

function beginBubbleEdit(wrapper, bubble, actions) {
    if (state.isAiResponding) return;

    actions.style.display = 'none';
    const currentText = bubble.dataset.rawText || bubble.textContent || '';
    const originalAttachments = bubble._attachments || [];
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
        restoreEditableBubble(bubble, actions, currentText, originalAttachments);
    });

    editContainer.querySelector('.edit-btn-save').addEventListener('click', () => {
        const newText = textarea.value.trim();
        if (!newText && !originalAttachments.length) return;

        const displayText = buildUserBubbleText(newText, originalAttachments);
        restoreEditableBubble(bubble, actions, displayText, originalAttachments);

        let next = wrapper.nextElementSibling;
        while (next) {
            const temp = next;
            next = next.nextElementSibling;
            temp.remove();
        }

        processAiResponse({ text: newText, attachments: originalAttachments });
    });
}

function retryLastMessage(button, wrapper) {
    const userWrappers = dom.chatArea.querySelectorAll('.message-wrapper--user');
    const lastUserWrapper = userWrappers[userWrappers.length - 1];
    const lastUserBubble = lastUserWrapper?.querySelector('.chat-bubble');
    const lastUserText = lastUserBubble?.dataset.rawText || lastUserBubble?.textContent;

    if (!lastUserText || !lastUserWrapper) return;

    wrapper.remove();
    lastUserWrapper.remove();

    const lastUserAttachments = lastUserBubble?._attachments || [];
    appendBubble(
        lastUserText,
        'user',
        true,
        buildUserBubbleText(lastUserText, lastUserAttachments),
        lastUserText,
        lastUserAttachments
    );
    processAiResponse({ text: lastUserText, attachments: lastUserAttachments });
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
    if (!button || !dom.chatArea.contains(button)) return;

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
        beginBubbleEdit(wrapper, bubble, wrapper.querySelector('.bubble-actions'));
        return;
    }

    if (title === 'Like') {
        toggleBubbleLike(button, bubble, '#4b3fd8', '[title="Dislike"]');
        return;
    }

    if (title === 'Dislike') {
        toggleBubbleLike(button, bubble, '#ef4444', '[title="Like"]');
        return;
    }

    if (title === 'Retry') {
        const svg = button.querySelector('svg');
        if (svg) {
            svg.classList.add('spin-once');
            svg.addEventListener('animationend', () => svg.classList.remove('spin-once'), { once: true });
        }

        retryLastMessage(button, wrapper);
    }
}

export function bindChatInteractions() {
    if (chatBound || !dom.chatArea) return;
    chatBound = true;

    dom.chatArea.addEventListener('scroll', () => {
        const distanceFromBottom = dom.chatArea.scrollHeight - dom.chatArea.scrollTop - dom.chatArea.clientHeight;
        state.userHasScrolledUp = distanceFromBottom > 60;
    });

    dom.chatArea.addEventListener('click', handleBubbleActionClick);
}

export async function processAiResponse({ text, attachments = [] }) {
    state.isAiResponding = true;
    state.abortController = new AbortController();

    setSendButtonState(true);

    dom.chatArea.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach((btn) => {
        btn.classList.add('disabled');
    });

    const aiBubble = appendBubble('', 'ai', false);
    const aiWrapper = aiBubble.closest('.message-wrapper');
    let phraseIndex = 0;

    function renderPhrase() {
        aiBubble.innerHTML = '';
        const wrapper = document.createElement('span');
        wrapper.className = 'phrase-wrapper';
        const shimmer = document.createElement('span');
        shimmer.className = 'shimmer-text';
        shimmer.textContent = CONFIG.THINKING_PHRASES[phraseIndex];
        wrapper.appendChild(shimmer);
        aiBubble.appendChild(wrapper);
    }

    renderPhrase();
    const thinkingInterval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % CONFIG.THINKING_PHRASES.length;
        renderPhrase();
    }, 2000);

    try {
        const { response, data, ok } = await sendChatRequest({
            message: text,
            model: state.currentModel,
            attachments,
            signal: state.abortController.signal,
            systemInstruction: state.activeAgent?.systemInstruction || undefined,
        });

        clearInterval(thinkingInterval);
        aiBubble.innerHTML = '';

        if (!ok) {
            aiBubble.textContent = `⚠️ ${data.error || 'Server error'}`;
            return false;
        }

        aiBubble.dataset.rawText = data.reply || '';
        await typeText(aiBubble, data.reply || '', CONFIG.TYPEWRITER.SPEED_MS, state.abortController.signal);

        if (aiWrapper) {
            aiWrapper.appendChild(createBubbleActions('ai'));
        }

        if (!state.userHasScrolledUp) {
            dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
        }

        return response.ok;
    } catch (err) {
        clearInterval(thinkingInterval);
        aiBubble.innerHTML = '';

        if (err.name === 'AbortError') {
            aiBubble.textContent = '⚠️ Generation stopped.';
        } else {
            aiBubble.textContent = '⚠️ Could not reach the backend. Is server.py running?';
            console.error('[Kali Agent] Fetch error:', err);
        }

        return false;
    } finally {
        state.isAiResponding = false;
        state.abortController = null;
        setSendButtonState(false);

        dom.chatArea.querySelectorAll('.message-wrapper--user .bubble-actions button[title="Edit"]').forEach((btn) => {
            btn.classList.remove('disabled');
        });
    }
}

export async function typeText(element, text, speed = CONFIG.TYPEWRITER.SPEED_MS, signal = null) {
    element.innerHTML = '';
    let i = 0;

    return new Promise((resolve) => {
        function type() {
            if (signal && signal.aborted) {
                element.innerHTML = renderMarkdown(text.slice(0, i));
                highlightCodeBlocks(element);
                scrollChatToBottom();
                resolve();
                return;
            }

            if (i < text.length) {
                i = Math.min(i + CONFIG.TYPEWRITER.CHUNK_SIZE, text.length);
                element.innerHTML = renderMarkdown(text.slice(0, i));
                if (!state.userHasScrolledUp) {
                    dom.chatArea.scrollTop = dom.chatArea.scrollHeight;
                }
                setTimeout(type, speed);
                return;
            }

            element.innerHTML = renderMarkdown(text);
            highlightCodeBlocks(element);
            scrollChatToBottom();
            resolve();
        }

        type();
    });
}

export async function sendMessage() {
    state.userHasScrolledUp = false;

    const text = dom.inputBox.value.trim();
    const attachments = state.attachedFiles.slice();
    if (!text && !attachments.length) return;

    dom.inputBox.value = '';
    resetComposerHeight();

    const displayText = buildUserBubbleText(text, attachments);
    const rawText = text.trim() || displayText;
    appendBubble(displayText, 'user', true, displayText, rawText, attachments);

    clearAttachments();

    await processAiResponse({ text, attachments });
}




