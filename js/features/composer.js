import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { resetChatSession } from '../services/chatApi.js';
import { addAttachments, clearAttachments, showAttachmentError } from './attachments.js';
import { clearConversation, resetComposerHeight, sendMessage } from './messages.js';
import { state } from '../state.js';

let composerBound = false;
let resizeTarget = null;

function setActiveModel(option) {
    state.currentModel = option.getAttribute('data-model');
    const model = CONFIG.MODELS.OPTIONS.find((item) => item.value === state.currentModel);
    const selectedModelText = model?.label || option.textContent.trim();
    const selectedOption = dom.modelOptions.find((item) => item.getAttribute('data-model') === state.currentModel);
    const optionDot = selectedOption?.querySelector('.model-dot');

    [dom.selectedModelText, dom.workspaceSelectedModelText, dom.codingSelectedModelText].forEach((label) => {
        if (label) label.textContent = selectedModelText;
    });

    [dom.modelSelectBtn, dom.workspaceModelSelectBtn, dom.codingModelSelectBtn].forEach((button) => {
        const dot = button?.querySelector('.model-dot');
        if (dot && optionDot) dot.style.background = optionDot.style.background;
    });

    [dom.modelDropdown, dom.workspaceModelDropdown, dom.codingModelDropdown].forEach((dropdown) => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

export function setWebSearchMode(enabled) {
    state.webSearchEnabled = Boolean(enabled);

    [dom.webSearchToggle, dom.codingWebSearchToggle].forEach((toggle) => {
        if (!toggle) return;
        toggle.classList.toggle('is-active', state.webSearchEnabled);
        toggle.setAttribute('aria-pressed', String(state.webSearchEnabled));
        toggle.setAttribute(
            'title',
            state.webSearchEnabled ? 'Web search is on — click to turn off' : 'Search the web with Google'
        );
        toggle.setAttribute(
            'aria-label',
            state.webSearchEnabled ? 'Turn off web search' : 'Search the web with Google'
        );
    });

    [dom.inputWrapper, dom.codingInputWrapper].forEach((wrapper) => {
        wrapper?.classList.toggle('is-web-search', state.webSearchEnabled);
    });

    if (dom.inputBox) {
        dom.inputBox.placeholder = state.webSearchEnabled
            ? 'Search the web...'
            : 'Ask anything...';
    }

    if (dom.codingPrompt) {
        dom.codingPrompt.placeholder = state.webSearchEnabled
            ? 'Search the web about this code...'
            : 'Describe the code change...';
    }
}

function bindComposerResize(wrapper, textarea) {
    if (!wrapper || !textarea) return;

    wrapper.addEventListener('mousemove', (event) => {
        if (state.isResizing) return;
        const isTopEdge = event.clientY - wrapper.getBoundingClientRect().top < 8;
        const cursor = isTopEdge ? 'ns-resize' : 'text';
        wrapper.style.cursor = cursor;
        textarea.style.cursor = cursor;
    });

    wrapper.addEventListener('mousedown', (event) => {
        if (event.clientY - wrapper.getBoundingClientRect().top >= 8) return;
        resizeTarget = textarea;
        state.isResizing = true;
        state.startY = event.clientY;
        state.startHeight = textarea.getBoundingClientRect().height;
        event.preventDefault();
    });
}

function resetConversation() {
    if (state.isAiResponding) return;

    clearConversation();
    state.userHasScrolledUp = false;
    if (dom.inputBox) {
        dom.inputBox.value = '';
    }

    resetComposerHeight();
    clearAttachments();
    state.currentModel = CONFIG.MODELS.DEFAULT;

    const defaultModel = CONFIG.MODELS.OPTIONS.find((item) => item.value === CONFIG.MODELS.DEFAULT);
    if (defaultModel && dom.selectedModelText) {
        dom.selectedModelText.textContent = defaultModel.label;
    }

    const defaultOption = dom.modelOptions.find((option) => option.getAttribute('data-model') === CONFIG.MODELS.DEFAULT);
    if (defaultOption) {
        setActiveModel(defaultOption);
    }

    resetChatSession();
}

function exportConversation() {
    const messages = [];
    dom.chatArea?.querySelectorAll('.chat-bubble').forEach((bubble) => {
        messages.push(bubble.dataset.rawText || bubble.textContent || '');
    });

    const blob = new Blob([messages.join('\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-export.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function handleModelDropdownClick(event) {
    const option = event.target.closest('.model-option');
    if (!option) return;
    setActiveModel(option);
}

export function bindComposerEvents() {
    if (composerBound) return;
    composerBound = true;

    if (dom.inputBox) {
        dom.inputBox.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });

        dom.inputBox.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!state.isAiResponding) {
                    sendMessage();
                }
            }
        });
    }

    if (dom.attachmentInput) {
        dom.attachmentInput.addEventListener('change', (event) => {
            addAttachments(event.target.files);
            event.target.value = '';
        });
    }

    if (dom.plusBtn) {
        dom.plusBtn.addEventListener('click', () => {
            if (state.isAiResponding) return;
            showAttachmentError('');
            dom.attachmentInput?.click();
        });
    }

    if (dom.newChatBtn) {
        dom.newChatBtn.addEventListener('click', resetConversation);
    }

    if (dom.exportBtn) {
        dom.exportBtn.addEventListener('click', exportConversation);
    }

    if (dom.sendBtn) {
        dom.sendBtn.addEventListener('click', () => {
            if (state.isAiResponding) {
                state.abortController?.abort();
                return;
            }

            sendMessage();
        });
    }

    [
        [dom.modelSelectBtn, dom.modelDropdown],
        [dom.workspaceModelSelectBtn, dom.workspaceModelDropdown],
        [dom.codingModelSelectBtn, dom.codingModelDropdown],
    ].forEach(([button, dropdown]) => {
        if (button && dropdown) {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });

            dropdown.addEventListener('click', handleModelDropdownClick);
        }
    });

    document.addEventListener('click', (event) => {
        [
            [dom.modelSelectBtn, dom.modelDropdown],
            [dom.workspaceModelSelectBtn, dom.workspaceModelDropdown],
            [dom.codingModelSelectBtn, dom.codingModelDropdown],
        ].forEach(([button, dropdown]) => {
            if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    if (dom.webSearchToggle) {
        dom.webSearchToggle.addEventListener('click', () => {
            setWebSearchMode(!state.webSearchEnabled);
        });
    }

    if (dom.codingWebSearchToggle) {
        dom.codingWebSearchToggle.addEventListener('click', () => {
            setWebSearchMode(!state.webSearchEnabled);
        });
    }

    if (dom.codingPasteActionBtn && dom.codingFileInput) {
        dom.codingPasteActionBtn.addEventListener('click', () => {
            dom.codingFileInput.click();
        });
    }

    bindComposerResize(dom.inputWrapper, dom.inputBox);
    bindComposerResize(dom.workspaceChatInput?.closest('.input-box-wrapper'), dom.workspaceChatInput);
    bindComposerResize(dom.codingInputWrapper, dom.codingPrompt);

    document.addEventListener('mousemove', (event) => {
        if (!state.isResizing || !resizeTarget) return;
        const newHeight = Math.min(
            CONFIG.COMPOSER.MAX_INPUT_HEIGHT,
            Math.max(CONFIG.COMPOSER.MIN_INPUT_HEIGHT, state.startHeight + (state.startY - event.clientY))
        );
        resizeTarget.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        state.isResizing = false;
        resizeTarget = null;
    });

    const defaultOption = dom.modelOptions.find((option) => option.getAttribute('data-model') === state.currentModel);
    if (defaultOption) {
        setActiveModel(defaultOption);
    }

    setWebSearchMode(state.webSearchEnabled);
}
