const query = (selector) => document.querySelector(selector);

export const dom = {
    inputBox: query('.input-box'),
    inputWrapper: query('.input-box-wrapper'),
    attachmentInput: query('#attachmentInput'),
    attachmentTray: query('#attachmentTray'),
    attachmentError: query('#attachmentError'),
    chatArea: query('.chat-area'),
    emptyStateTemplate: query('#emptyStateTemplate'),
    emptyStateHTML: query('#emptyStateTemplate')?.innerHTML.trim() || '',
    modelSelectBtn: query('#modelSelectBtn'),
    modelDropdown: query('#modelDropdown'),
    selectedModelText: query('#selectedModelText'),
    modelOptions: Array.from(document.querySelectorAll('.model-option')),
    sidebarShell: query('.sidebar-shell'),
    sendBtn: query('.send-btn'),
    sendBtnIcon: query('.send-btn-icon'),
    plusBtn: query('.plus-btn'),
    newChatBtn: query('.header-actions .icon-btn[aria-label="New chat"]'),
    exportBtn: query('.header-actions .icon-btn[aria-label="Export"]'),
    sidebarToggleBtn: query('.header-actions .icon-btn[aria-label="Toggle sidebar"]'),
    rightNav: query('.right-nav'),
};
