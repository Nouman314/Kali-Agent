import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { state } from '../state.js';

let attachmentErrorTimer = null;
let trayBound = false;

const CODE_ATTACHMENT_PALETTE = {
    rs: ['#fff7ed', '#c2410c'],
    py: ['#eff6ff', '#2563eb'],
    js: ['#fef9c3', '#a16207'],
    jsx: ['#fef9c3', '#a16207'],
    mjs: ['#fef9c3', '#a16207'],
    cjs: ['#fef9c3', '#a16207'],
    ts: ['#dbeafe', '#1d4ed8'],
    tsx: ['#dbeafe', '#1d4ed8'],
    java: ['#fee2e2', '#b91c1c'],
    c: ['#e0e7ff', '#4338ca'],
    h: ['#e0e7ff', '#4338ca'],
    cpp: ['#e0e7ff', '#4338ca'],
    hpp: ['#e0e7ff', '#4338ca'],
    cc: ['#e0e7ff', '#4338ca'],
    hh: ['#e0e7ff', '#4338ca'],
    cs: ['#f3e8ff', '#7e22ce'],
    go: ['#cffafe', '#0e7490'],
    rb: ['#ffe4e6', '#be123c'],
    php: ['#e0e7ff', '#4338ca'],
    swift: ['#ffedd5', '#c2410c'],
    kt: ['#f3e8ff', '#7e22ce'],
    kts: ['#f3e8ff', '#7e22ce'],
    scala: ['#fee2e2', '#b91c1c'],
    sh: ['#e5e7eb', '#374151'],
    bash: ['#e5e7eb', '#374151'],
    zsh: ['#e5e7eb', '#374151'],
    ps1: ['#dbeafe', '#1e40af'],
    psm1: ['#dbeafe', '#1e40af'],
    sql: ['#dbeafe', '#1d4ed8'],
    html: ['#ffedd5', '#c2410c'],
    htm: ['#ffedd5', '#c2410c'],
    css: ['#dbeafe', '#1d4ed8'],
    scss: ['#fce7f3', '#be185d'],
    sass: ['#fce7f3', '#be185d'],
    less: ['#dbeafe', '#1e40af'],
    json: ['#fef3c7', '#92400e'],
    xml: ['#ffedd5', '#9a3412'],
    yaml: ['#f3e8ff', '#6b21a8'],
    yml: ['#f3e8ff', '#6b21a8'],
    toml: ['#f3e8ff', '#6b21a8'],
    ini: ['#f3e8ff', '#6b21a8'],
    cfg: ['#f3e8ff', '#6b21a8'],
    txt: ['#f3f4f6', '#4b5563'],
    md: ['#e5e7eb', '#374151'],
    markdown: ['#e5e7eb', '#374151'],
};

const CODE_ATTACHMENT_LABELS = {
    markdown: 'MD',
};

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAttachmentKind(file) {
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return 'image';
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';
    if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || name.endsWith('.pptx')) return 'pptx';
    return 'unsupported';
}

export function showAttachmentError(message) {
    if (!dom.attachmentError) return;

    if (!message) {
        dom.attachmentError.hidden = true;
        dom.attachmentError.textContent = '';
        return;
    }

    dom.attachmentError.textContent = message;
    dom.attachmentError.hidden = false;
    clearTimeout(attachmentErrorTimer);
    attachmentErrorTimer = setTimeout(() => {
        dom.attachmentError.hidden = true;
        dom.attachmentError.textContent = '';
    }, 3500);
}

export function createAttachmentChip(entry, variant = 'composer') {
    const chip = document.createElement('div');
    chip.className = `attachment-chip${entry.kind === 'image' ? ' attachment-chip--image' : ''}${variant === 'bubble' ? ' attachment-chip--bubble' : ''}`;
    chip.dataset.attachmentId = String(entry.id);

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
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 15v6h1.5a1.5 1.5 0 0 0 1.5 -1.5v-3a1.5 1.5 0 0 0 -1.5 -1.5h-1.5" /><path d="M11 16.5v3a1.5 1.5 0 0 0 3 0v-3a1.5 1.5 0 0 0 -3 0z" /><path d="M20 15h-1.5a1.5 1.5 0 0 0 -1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5h1.5" /></svg>';
            icon.classList.add('attachment-icon--docx');
        } else if (entry.kind === 'code') {
            const extension = entry.file.name.split('.').pop().toLowerCase();
            const [background, color] = CODE_ATTACHMENT_PALETTE[extension] || ['#f3f4f6', '#4b5563'];
            icon.classList.add('attachment-icon--code');
            icon.textContent = CODE_ATTACHMENT_LABELS[extension] || extension.toUpperCase();
            icon.style.backgroundColor = background;
            icon.style.color = color;
        } else {
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M5 21v-6h1.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1 -1.5 1.5h-1.5" /><path d="M11 21v-6h1.5a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1 -1.5 1.5h-1.5" /><path d="M17 15h4" /><path d="M19 15v6" /></svg>';
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
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 16px; height: 16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        chip.appendChild(removeBtn);
    }

    return chip;
}

export function renderAttachmentTray() {
    if (!dom.attachmentTray) return;

    dom.attachmentTray.innerHTML = '';

    if (!state.attachedFiles.length) {
        dom.attachmentTray.hidden = true;
        showAttachmentError('');
        return;
    }

    dom.attachmentTray.hidden = false;
    showAttachmentError('');

    state.attachedFiles.forEach((entry) => {
        dom.attachmentTray.appendChild(createAttachmentChip(entry, 'composer'));
    });
}

export function removeAttachment(id) {
    const next = [];

    state.attachedFiles.forEach((entry) => {
        if (entry.id === id) {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            return;
        }

        next.push(entry);
    });

    state.attachedFiles = next;
    renderAttachmentTray();
}

export function clearAttachments() {
    state.attachedFiles.forEach((entry) => {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    });

    state.attachedFiles = [];

    if (dom.attachmentInput) {
        dom.attachmentInput.value = '';
    }

    renderAttachmentTray();
}

export function addAttachments(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const remainingSlots = CONFIG.COMPOSER.MAX_ATTACHMENTS - state.attachedFiles.length;
    if (remainingSlots <= 0) {
        showAttachmentError(`You can attach up to ${CONFIG.COMPOSER.MAX_ATTACHMENTS} files at a time.`);
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

        if (file.size > CONFIG.COMPOSER.MAX_FILE_SIZE_BYTES) {
            showAttachmentError(`${file.name} is larger than 10 MB.`);
            continue;
        }

        const duplicate = state.attachedFiles.some((entry) =>
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
            id: ++state.attachmentIdCounter,
            file,
            kind,
            previewUrl: kind === 'image' ? URL.createObjectURL(file) : '',
        });
    }

    if (!accepted.length) return;

    state.attachedFiles = state.attachedFiles.concat(accepted).slice(0, CONFIG.COMPOSER.MAX_ATTACHMENTS);
    renderAttachmentTray();

    if (hitLimit) {
        showAttachmentError(`You can attach up to ${CONFIG.COMPOSER.MAX_ATTACHMENTS} files at a time.`);
    }
}

export function buildUserBubbleText(text, attachments) {
    const message = text.trim();
    if (message) return message;

    if (attachments.length) {
        return `Attached ${attachments.length} file${attachments.length === 1 ? '' : 's'}`;
    }

    return '';
}

export function serializeAttachments() {
    return state.attachedFiles.slice();
}

export function bindAttachmentTrayInteractions() {
    if (trayBound || !dom.attachmentTray) return;
    trayBound = true;

    dom.attachmentTray.addEventListener('click', (event) => {
        const button = event.target.closest('.attachment-remove');
        if (!button) return;

        const chip = button.closest('.attachment-chip');
        if (!chip) return;

        removeAttachment(Number(chip.dataset.attachmentId));
    });
}
