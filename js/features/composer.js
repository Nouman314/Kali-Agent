import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { resetChatSession } from '../services/chatApi.js';
import { addAttachments, clearAttachments, showAttachmentError } from './attachments.js';
import { renderEmptyState, resetComposerHeight, sendMessage } from './messages.js';
import { state } from '../state.js';

let composerBound = false;

function setActiveModel(option) {
    state.currentModel = option.getAttribute('data-model');
    if (dom.selectedModelText) {
        dom.selectedModelText.textContent = option.textContent.trim();
    }

    if (dom.modelDropdown) {
        dom.modelDropdown.style.display = 'none';
    }

    const mainDot = dom.modelSelectBtn?.querySelector('.model-dot');
    const optionDot = option.querySelector('.model-dot');
    if (mainDot && optionDot) {
        mainDot.style.background = optionDot.style.background;
    }
}

function updateResizeCursor(event) {
    if (state.isResizing || !dom.inputWrapper || !dom.inputBox) return;

    const isTopEdge = event.clientY - dom.inputWrapper.getBoundingClientRect().top < 8;
    const cursor = isTopEdge ? 'ns-resize' : 'text';
    dom.inputWrapper.style.cursor = cursor;
    dom.inputBox.style.cursor = cursor;
}

function tryStartResize(event) {
    if (!dom.inputWrapper || !dom.inputBox) return;

    const isTopEdge = event.clientY - dom.inputWrapper.getBoundingClientRect().top < 8;
    if (!isTopEdge) return;

    state.isResizing = true;
    state.startY = event.clientY;
    state.startHeight = dom.inputBox.getBoundingClientRect().height;
    event.preventDefault();
}

function resetConversation() {
    if (state.isAiResponding) return;

    renderEmptyState();
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

    if (dom.modelSelectBtn && dom.modelDropdown) {
        dom.modelSelectBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            dom.modelDropdown.style.display = dom.modelDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    if (dom.modelDropdown) {
        dom.modelDropdown.addEventListener('click', handleModelDropdownClick);
    }

    document.addEventListener('click', (event) => {
        if (!dom.modelDropdown || !dom.modelSelectBtn) return;
        if (!dom.modelDropdown.contains(event.target) && !dom.modelSelectBtn.contains(event.target)) {
            dom.modelDropdown.style.display = 'none';
        }
    });

    if (dom.inputWrapper && dom.inputBox) {
        dom.inputWrapper.addEventListener('mousemove', updateResizeCursor);
        dom.inputBox.addEventListener('mousemove', updateResizeCursor);
        dom.inputWrapper.addEventListener('mousedown', tryStartResize);
        dom.inputBox.addEventListener('mousedown', tryStartResize);
    }

    document.addEventListener('mousemove', (event) => {
        if (!state.isResizing || !dom.inputBox) return;
        const newHeight = Math.min(CONFIG.COMPOSER.MAX_INPUT_HEIGHT, Math.max(CONFIG.COMPOSER.MIN_INPUT_HEIGHT, state.startHeight + (state.startY - event.clientY)));
        dom.inputBox.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        state.isResizing = false;
    });

    const defaultOption = dom.modelOptions.find((option) => option.getAttribute('data-model') === state.currentModel);
    if (defaultOption) {
        setActiveModel(defaultOption);
    }
}
