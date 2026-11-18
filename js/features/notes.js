import { state } from '../state.js';
import { sendChatRequest } from '../services/chatApi.js';

const STORAGE_KEY = 'kali_notes';
const STARTER_NOTE_IDS = new Set([
    'cell-biology-review',
    'design-sync',
    'enzyme-lab',
    'membrane-transport',
    'climate-reading-list',
]);

const SOURCE_ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2 1-4a7.5 7.5 0 1 1 16-5.5z"></path></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"></path></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>',
};

const FOLDER_LABELS = {
    all: 'All notes',
    chat: 'Saved from chat',
    study: 'Study',
    work: 'Work',
    archived: 'Archived',
};

let notes = loadNotes();
let activeFolder = 'all';
let selectedNoteId = null;
let saveTimer = null;
let statusTimer = null;
let notesBound = false;
let summaryRequestId = 0;

const elements = {
    view: document.querySelector('#notesView'),
    total: document.querySelector('#notesTotal'),
    search: document.querySelector('#notesSearch'),
    sort: document.querySelector('#notesSort'),
    newButton: document.querySelector('#newNoteBtn'),
    folders: Array.from(document.querySelectorAll('.notes-folder')),
    folderTitle: document.querySelector('#notesFolderTitle'),
    listDescription: document.querySelector('#notesListDescription'),
    cards: document.querySelector('#notesCards'),
    editorPane: document.querySelector('#notesEditorPane'),
    emptyNewButton: document.querySelector('#notesEmptyNewBtn'),
    backButton: document.querySelector('#notesBackBtn'),
    source: document.querySelector('#notesEditorSource'),
    pinButton: document.querySelector('#notesPinBtn'),
    archiveButton: document.querySelector('#notesArchiveBtn'),
    deleteButton: document.querySelector('#notesDeleteBtn'),
    deleteDialog: document.querySelector('#notesDeleteDialog'),
    deleteDescription: document.querySelector('#notesDeleteDescription'),
    deleteCancelButton: document.querySelector('#notesDeleteCancel'),
    deleteConfirmButton: document.querySelector('#notesDeleteConfirm'),
    title: document.querySelector('#notesTitleInput'),
    editor: document.querySelector('#notesEditorBody'),
    toolbar: document.querySelector('.notes-editor-toolbar'),
    summarizeButton: document.querySelector('#notesSummarizeBtn'),
    summarizeLabel: document.querySelector('#notesSummarizeBtn span'),
    saveStatus: document.querySelector('#notesSaveStatus'),
    wordCount: document.querySelector('#notesWordCount'),
    export: document.querySelector('#notesExport'),
};

function loadNotes() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new TypeError('Saved notes must be an array');
        return parsed.filter((note) => note && typeof note.id === 'string' && !STARTER_NOTE_IDS.has(note.id)).map((note) => ({
            ...note,
            title: typeof note.title === 'string' ? note.title : '',
            content: sanitizeContent(typeof note.content === 'string' ? note.content : ''),
            tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === 'string') : [],
            folder: ['study', 'work', 'chat'].includes(note.folder) ? note.folder : 'chat',
            source: ['chat', 'web', 'file'].includes(note.source) ? note.source : 'chat',
            pinned: Boolean(note.pinned),
            archived: Boolean(note.archived),
            updatedAt: typeof note.updatedAt === 'string' ? note.updatedAt : new Date().toISOString(),
        }));
    } catch (error) {
        console.error('[Kali Agent] Failed to load notes:', error);
        return [];
    }
}

function sanitizeContent(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const allowedTags = new Set(['A', 'B', 'BR', 'DIV', 'EM', 'H1', 'H2', 'H3', 'I', 'INPUT', 'LI', 'MARK', 'OL', 'P', 'SPAN', 'STRONG', 'UL']);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
        if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
        if (!allowedTags.has(node.tagName)) {
            const fragment = document.createDocumentFragment();
            Array.from(node.childNodes).forEach((child) => fragment.appendChild(cleanNode(child)));
            return fragment;
        }

        const safe = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === 'DIV' || node.tagName === 'SPAN') {
            const allowedClasses = ['notes-checklist', 'notes-checklist-item', 'notes-summary-draft'];
            const classes = Array.from(node.classList).filter((className) => allowedClasses.includes(className));
            if (classes.length) safe.className = classes.join(' ');
        }
        if (node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox') {
            safe.type = 'checkbox';
            safe.defaultChecked = node.checked;
            safe.checked = node.checked;
        }
        if (node.tagName === 'A') {
            const href = node.getAttribute('href') || '';
            if (/^(https?:|mailto:)/i.test(href)) safe.setAttribute('href', href);
        }
        if (node.hasAttribute('contenteditable') && node.tagName === 'SPAN') {
            safe.setAttribute('contenteditable', 'true');
        }
        Array.from(node.childNodes).forEach((child) => safe.appendChild(cleanNode(child)));
        return safe;
    }

    const wrapper = document.createElement('div');
    Array.from(parsed.body.childNodes).forEach((node) => wrapper.appendChild(cleanNode(node)));
    return wrapper.innerHTML;
}

function persistNotes() {
    window.clearTimeout(statusTimer);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        elements.saveStatus.textContent = 'Saved';
        elements.saveStatus.parentElement.classList.remove('is-error');
        return true;
    } catch (error) {
        console.error('[Kali Agent] Failed to save notes:', error);
        elements.saveStatus.textContent = 'Not saved';
        elements.saveStatus.parentElement.classList.add('is-error');
        return false;
    }
}

function showTransientStatus(message, isError = false) {
    window.clearTimeout(statusTimer);
    elements.saveStatus.textContent = message;
    elements.saveStatus.parentElement.classList.toggle('is-error', isError);
    statusTimer = window.setTimeout(() => {
        if (elements.saveStatus.textContent !== message) return;
        elements.saveStatus.textContent = 'Saved';
        elements.saveStatus.parentElement.classList.remove('is-error');
    }, 3200);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

function getVisibleNotes() {
    const query = elements.search.value.trim().toLowerCase();
    const visible = notes.filter((note) => {
        if (activeFolder === 'all' && note.archived) return false;
        if (activeFolder === 'archived' && !note.archived) return false;
        if (activeFolder === 'chat' && (note.archived || note.source !== 'chat')) return false;
        if (activeFolder === 'study' && (note.archived || note.folder !== 'study')) return false;
        if (activeFolder === 'work' && (note.archived || note.folder !== 'work')) return false;
        if (!query) return true;
        const text = `${note.title} ${plainText(note.content)} ${note.tags.join(' ')}`.toLowerCase();
        return text.includes(query);
    });

    return visible.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (elements.sort.value === 'title') return a.title.localeCompare(b.title);
        const dateDifference = new Date(b.updatedAt) - new Date(a.updatedAt);
        return elements.sort.value === 'oldest' ? -dateDifference : dateDifference;
    });
}

function plainText(html) {
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    body.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(' '));
    body.querySelectorAll('h1, h2, h3, p, ul, ol, li, div').forEach((block) => block.append(' '));
    return (body.textContent || '').replace(/\s+/g, ' ').trim();
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function renderFolderCounts() {
    const counts = {
        all: notes.filter((note) => !note.archived).length,
        chat: notes.filter((note) => !note.archived && note.source === 'chat').length,
        study: notes.filter((note) => !note.archived && note.folder === 'study').length,
        work: notes.filter((note) => !note.archived && note.folder === 'work').length,
        archived: notes.filter((note) => note.archived).length,
    };

    elements.folders.forEach((folder) => {
        const key = folder.dataset.folder;
        const count = folder.querySelector('.notes-folder-count');
        if (count) count.textContent = String(counts[key] || 0);
    });
    elements.total.textContent = `${counts.all} ${counts.all === 1 ? 'note' : 'notes'}`;
}

function renderCards() {
    const visibleNotes = getVisibleNotes();
    elements.cards.replaceChildren();
    elements.folderTitle.textContent = FOLDER_LABELS[activeFolder];
    elements.listDescription.textContent = elements.search.value.trim()
        ? `${visibleNotes.length} matching ${visibleNotes.length === 1 ? 'note' : 'notes'}`
        : 'Your recent notes in one place';

    if (!visibleNotes.some((note) => note.id === selectedNoteId)) {
        selectedNoteId = null;
        clearEditor();
        elements.view.classList.remove('is-editor-open');
    }

    visibleNotes.forEach((note) => {
        const card = document.createElement('button');
        card.className = `notes-card${note.id === selectedNoteId ? ' is-selected' : ''}`;
        card.type = 'button';
        card.setAttribute('aria-pressed', String(note.id === selectedNoteId));
        card.setAttribute('aria-label', `${note.title || 'Untitled note'}, ${formatDate(note.updatedAt)}`);

        const title = escapeHtml(note.title || 'Untitled note');
        const preview = escapeHtml(plainText(note.content).trim() || 'No preview yet.');
        const tags = note.tags.map((tag) => `<span class="notes-tag notes-tag--${escapeHtml(tag.toLowerCase())}">${escapeHtml(tag)}</span>`).join('');
        const pin = note.pinned
            ? '<svg class="notes-card-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Pinned"><path d="m16 3 5 5-4 1-4 4 3 3-2 2-4-4-5 5"></path><path d="m8 8 4 4"></path></svg>'
            : '';

        card.innerHTML = `
            <span class="notes-card-title-row"><span class="notes-card-title">${title}</span>${pin}</span>
            <span class="notes-card-preview">${preview}</span>
            <span class="notes-card-tags">${tags}</span>
            <span class="notes-card-footer">
                <span class="notes-source-icon" aria-label="${escapeHtml(note.source)}">${SOURCE_ICONS[note.source]}</span>
                <span class="notes-card-folder">${escapeHtml(note.archived ? 'Archived' : FOLDER_LABELS[note.folder])}</span>
                <time class="notes-card-date" datetime="${escapeHtml(note.updatedAt)}">${formatDate(note.updatedAt)}</time>
            </span>`;
        card.addEventListener('click', () => {
            selectedNoteId = note.id;
            renderEditor();
            renderCards();
            elements.view.classList.add('is-editor-open');
        });
        elements.cards.appendChild(card);
    });

    if (visibleNotes.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'notes-empty-state';
        empty.textContent = elements.search.value.trim()
            ? 'No notes match your search. Try another keyword.'
            : 'No notes in this folder yet. Create a note to get started.';
        elements.cards.appendChild(empty);
    }

    renderFolderCounts();
}

function renderEditor() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note) return clearEditor();

    summaryRequestId += 1;
    setSummaryButtonBusy(false);
    elements.editorPane.classList.add('has-note');
    elements.title.value = note.title;
    elements.editor.innerHTML = sanitizeContent(note.content);
    elements.source.textContent = note.source === 'chat' ? 'Saved from chat' : note.source === 'web' ? 'Saved from web' : 'Saved from file';
    elements.pinButton.classList.toggle('is-active', note.pinned);
    elements.pinButton.setAttribute('aria-pressed', String(note.pinned));
    elements.pinButton.setAttribute('aria-label', note.pinned ? 'Unpin note' : 'Pin note');
    elements.pinButton.title = note.pinned ? 'Unpin note' : 'Pin note';
    elements.archiveButton.classList.toggle('is-active', note.archived);
    elements.archiveButton.setAttribute('aria-label', note.archived ? 'Restore note' : 'Archive note');
    elements.archiveButton.title = note.archived ? 'Restore note' : 'Archive note';
    elements.archiveButton.setAttribute('aria-pressed', String(note.archived));
    const archiveIcon = elements.archiveButton.querySelector('svg');
    archiveIcon.innerHTML = note.archived
        ? '<path d="M3 5h18v4H3zM5 9v10h14V9"></path><path d="M12 17v-7m-3 3 3-3 3 3"></path>'
        : '<path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"></path>';
    updateWordCount();
}

function clearEditor() {
    summaryRequestId += 1;
    setSummaryButtonBusy(false);
    elements.editorPane.classList.remove('has-note');
    elements.title.value = '';
    elements.editor.replaceChildren();
    elements.source.textContent = 'No note selected';
    elements.pinButton.classList.remove('is-active');
    elements.pinButton.setAttribute('aria-pressed', 'false');
    elements.archiveButton.classList.remove('is-active');
    elements.archiveButton.setAttribute('aria-label', 'Archive note');
    elements.archiveButton.title = 'Archive note';
    elements.archiveButton.setAttribute('aria-pressed', 'false');
    updateWordCount();
}

function updateWordCount() {
    const content = (elements.editor.innerText || '').trim();
    const count = content ? content.split(/\s+/).filter(Boolean).length : 0;
    elements.wordCount.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
}

function getEditorContent() {
    const editorCopy = elements.editor.cloneNode(true);
    editorCopy.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        if (checkbox.checked) checkbox.setAttribute('checked', '');
        else checkbox.removeAttribute('checked');
    });
    return sanitizeContent(editorCopy.innerHTML);
}

function scheduleSave() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note) return;

    window.clearTimeout(statusTimer);
    elements.saveStatus.textContent = 'Saving...';
    elements.saveStatus.parentElement.classList.remove('is-error');
    note.title = elements.title.value.trim();
    note.content = getEditorContent();
    note.updatedAt = new Date().toISOString();
    updateWordCount();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        persistNotes();
        renderCards();
    }, 350);
}

function createNote() {
    const note = {
        id: `note-${Date.now()}`,
        title: '',
        folder: activeFolder === 'study' || activeFolder === 'work' ? activeFolder : 'chat',
        source: 'chat',
        tags: [],
        pinned: false,
        archived: false,
        updatedAt: new Date().toISOString(),
        content: '',
    };
    notes.unshift(note);
    activeFolder = 'all';
    elements.search.value = '';
    selectedNoteId = note.id;
    persistNotes();
    renderFolderSelection();
    renderEditor();
    renderCards();
    elements.view.classList.add('is-editor-open');
    elements.title.focus();
}

function renderFolderSelection() {
    elements.folders.forEach((folder) => {
        const active = folder.dataset.folder === activeFolder;
        folder.classList.toggle('is-active', active);
        folder.setAttribute('aria-pressed', String(active));
    });
}

function setFolder(folder) {
    activeFolder = folder;
    renderFolderSelection();
    renderCards();
}

function togglePin() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note) return;
    note.pinned = !note.pinned;
    note.updatedAt = new Date().toISOString();
    persistNotes();
    renderEditor();
    renderCards();
}

function toggleArchive() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note) return;
    note.archived = !note.archived;
    note.updatedAt = new Date().toISOString();
    activeFolder = note.archived ? 'archived' : 'all';
    renderFolderSelection();
    renderEditor();
    renderCards();
    if (persistNotes()) showTransientStatus(note.archived ? 'Note archived' : 'Note restored');
}

function openDeleteDialog() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note || !elements.deleteDialog) return;
    elements.deleteDescription.textContent = `“${note.title || 'Untitled note'}” will be permanently deleted. This can't be undone.`;
    elements.deleteDialog.hidden = false;
    elements.deleteCancelButton.focus();
}

function closeDeleteDialog(returnFocus = true) {
    if (!elements.deleteDialog) return;
    elements.deleteDialog.hidden = true;
    if (returnFocus && !elements.deleteButton.hidden) elements.deleteButton.focus();
}

function deleteSelectedNote() {
    const noteIndex = notes.findIndex((entry) => entry.id === selectedNoteId);
    if (noteIndex < 0) return closeDeleteDialog();

    notes.splice(noteIndex, 1);
    selectedNoteId = null;
    closeDeleteDialog(false);
    elements.view.classList.remove('is-editor-open');
    persistNotes();
    clearEditor();
    renderCards();
    elements.newButton.focus();
}

function handleDeleteDialogKeydown(event) {
    if (elements.deleteDialog.hidden) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        closeDeleteDialog();
        return;
    }
    if (event.key !== 'Tab') return;

    const buttons = [elements.deleteCancelButton, elements.deleteConfirmButton];
    const currentIndex = buttons.indexOf(document.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        elements.deleteConfirmButton.focus();
    } else if (!event.shiftKey && currentIndex === buttons.length - 1) {
        event.preventDefault();
        elements.deleteCancelButton.focus();
    }
}

function formatMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const children = Array.from(node.childNodes).map(formatMarkdown).join('');
    switch (node.tagName) {
        case 'H1':
        case 'H2':
        case 'H3':
            return `\n${'#'.repeat(Number(node.tagName[1]))} ${children}\n\n`;
        case 'P': return `${children}\n\n`;
        case 'STRONG':
        case 'B': return `**${children}**`;
        case 'EM':
        case 'I': return `*${children}*`;
        case 'MARK': return `==${children}==`;
        case 'BR': return '\n';
        case 'UL':
        case 'OL':
            return `${Array.from(node.children).map((child, index) => {
                const bullet = node.tagName === 'OL' ? `${index + 1}.` : '-';
                return `${bullet} ${formatMarkdown(child).trim()}`;
            }).join('\n')}\n\n`;
        case 'LI': return children;
        case 'A': return `[${children}](${node.getAttribute('href') || ''})`;
        case 'INPUT': return node.checked ? '[x]' : '[ ]';
        case 'DIV':
            if (node.classList.contains('notes-checklist-item')) {
                const checkbox = node.querySelector('input[type="checkbox"]');
                const label = node.querySelector('[contenteditable="true"]')?.textContent || '';
                return `- [${checkbox?.checked ? 'x' : ' '}] ${label}\n`;
            }
            return `${children}\n`;
        default: return children;
    }
}

function downloadFile(filename, content, mimeType) {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value) {
    return String(value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function docxRun(text, options = {}) {
    if (!text) return '';
    const properties = [
        options.bold ? '<w:b/>' : '',
        options.italic ? '<w:i/>' : '',
        options.underline ? '<w:u w:val="single"/>' : '',
        options.highlight ? '<w:highlight w:val="yellow"/>' : '',
        options.size ? `<w:sz w:val="${options.size}"/>` : '',
    ].join('');
    const runProperties = properties ? `<w:rPr>${properties}</w:rPr>` : '';
    return `<w:r>${runProperties}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxInline(node, options = {}) {
    if (node.nodeType === Node.TEXT_NODE) return docxRun(node.textContent || '', options);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'BR') return '<w:r><w:br/></w:r>';
    if (node.tagName === 'INPUT' && node.type === 'checkbox') return docxRun(node.checked ? '☒ ' : '☐ ', options);

    const nestedOptions = { ...options };
    if (['B', 'STRONG'].includes(node.tagName)) nestedOptions.bold = true;
    if (['I', 'EM'].includes(node.tagName)) nestedOptions.italic = true;
    if (node.tagName === 'A') nestedOptions.underline = true;
    if (node.tagName === 'MARK') nestedOptions.highlight = true;
    return Array.from(node.childNodes).map((child) => docxInline(child, nestedOptions)).join('');
}

function docxParagraph(runs, properties = '') {
    const paragraphProperties = properties ? `<w:pPr>${properties}</w:pPr>` : '';
    return `<w:p>${paragraphProperties}${runs || '<w:r><w:t></w:t></w:r>'}</w:p>`;
}

function docxList(node, depth = 0) {
    const ordered = node.tagName === 'OL';
    const items = Array.from(node.children).filter((child) => child.tagName === 'LI');
    return items.map((item, index) => {
        const inlineChildren = Array.from(item.childNodes).filter((child) => !['UL', 'OL'].includes(child.tagName));
        const prefix = ordered ? `${index + 1}. ` : '• ';
        const left = 720 * (depth + 1);
        const paragraph = docxParagraph(
            docxRun(prefix) + inlineChildren.map((child) => docxInline(child)).join(''),
            `<w:ind w:left="${left}"/>`,
        );
        const nestedLists = Array.from(item.children)
            .filter((child) => ['UL', 'OL'].includes(child.tagName))
            .map((child) => docxList(child, depth + 1))
            .join('');
        return paragraph + nestedLists;
    }).join('');
}

function docxBlock(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim();
        return text ? docxParagraph(docxRun(text)) : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'UL' || node.tagName === 'OL') return docxList(node);
    if (node.tagName === 'DIV' && node.classList.contains('notes-checklist-item')) {
        const checkbox = node.querySelector('input[type="checkbox"]');
        const label = node.querySelector('[contenteditable="true"]');
        const labelRuns = label ? Array.from(label.childNodes).map((child) => docxInline(child)).join('') : '';
        return docxParagraph(docxRun(checkbox?.checked ? '☒ ' : '☐ ') + labelRuns, '<w:ind w:left="360"/>');
    }
    if (node.tagName === 'DIV' && node.classList.contains('notes-checklist')) {
        return Array.from(node.children).map(docxBlock).join('');
    }
    if (node.tagName === 'DIV' && node.classList.contains('notes-summary-draft')) {
        return Array.from(node.children).map(docxBlock).join('');
    }
    if (/^H[1-3]$/.test(node.tagName)) {
        const size = node.tagName === 'H1' ? 32 : node.tagName === 'H2' ? 28 : 24;
        const runs = Array.from(node.childNodes).map((child) => docxInline(child, { bold: true, size })).join('');
        return docxParagraph(runs);
    }
    if (node.tagName === 'P' || node.tagName === 'LI') {
        return docxParagraph(Array.from(node.childNodes).map((child) => docxInline(child)).join(''));
    }
    if (node.tagName === 'BR') return docxParagraph('<w:r><w:br/></w:r>');
    return Array.from(node.childNodes).map(docxBlock).join('');
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function concatenateBytes(parts) {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    parts.forEach((part) => {
        result.set(part, offset);
        offset += part.length;
    });
    return result;
}

function createStoredZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach(({ name, content }) => {
        const nameBytes = encoder.encode(name);
        const dataBytes = encoder.encode(content);
        const checksum = crc32(dataBytes);
        const localHeader = new Uint8Array(30 + nameBytes.length);
        const localView = new DataView(localHeader.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(6, 0x0800, true);
        localView.setUint16(8, 0, true);
        localView.setUint16(10, 0, true);
        localView.setUint16(12, 0x21, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, dataBytes.length, true);
        localView.setUint32(22, dataBytes.length, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);
        localParts.push(localHeader, dataBytes);

        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const centralView = new DataView(centralHeader.buffer);
        centralView.setUint32(0, 0x02014b50, true);
        centralView.setUint16(4, 20, true);
        centralView.setUint16(6, 20, true);
        centralView.setUint16(8, 0x0800, true);
        centralView.setUint16(10, 0, true);
        centralView.setUint16(12, 0, true);
        centralView.setUint16(14, 0x21, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, dataBytes.length, true);
        centralView.setUint32(24, dataBytes.length, true);
        centralView.setUint16(28, nameBytes.length, true);
        centralView.setUint16(30, 0, true);
        centralView.setUint16(32, 0, true);
        centralView.setUint16(34, 0, true);
        centralView.setUint16(36, 0, true);
        centralView.setUint32(38, 0, true);
        centralView.setUint32(42, localOffset, true);
        centralHeader.set(nameBytes, 46);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + dataBytes.length;
    });

    const centralDirectory = concatenateBytes(centralParts);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralDirectory.length, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);
    return concatenateBytes([...localParts, centralDirectory, endRecord]);
}

function createDocx(note, editor) {
    const title = note.title.trim() || 'Untitled note';
    const titleRun = `<w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">${xmlEscape(title)}</w:t></w:r>`;
    const body = Array.from(editor.childNodes).map(docxBlock).join('');
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${docxParagraph(titleRun)}${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    const packageRelationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    return createStoredZip([
        { name: '[Content_Types].xml', content: contentTypes },
        { name: '_rels/.rels', content: packageRelationships },
        { name: 'word/document.xml', content: documentXml },
    ]);
}

function exportNote(format) {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    if (!note || !format) return;
    const filename = (note.title.trim() || 'note').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');

    if (format === 'md') {
        const content = `# ${note.title || 'Untitled note'}\n\n${formatMarkdown(elements.editor).trim()}\n`;
        downloadFile(`${filename}.md`, content, 'text/markdown;charset=utf-8');
    } else if (format === 'pdf') {
        document.body.classList.add('notes-printing');
        window.print();
        document.body.classList.remove('notes-printing');
    } else if (format === 'docx') {
        const docx = createDocx(note, elements.editor);
        downloadFile(`${filename}.docx`, docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    elements.export.value = '';
    elements.export.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertChecklist() {
    const html = '<div class="notes-checklist"><div class="notes-checklist-item"><input type="checkbox"><span contenteditable="true">New task</span></div><div class="notes-checklist-item"><input type="checkbox"><span contenteditable="true">New task</span></div><div class="notes-checklist-item"><input type="checkbox"><span contenteditable="true">New task</span></div></div><p><br></p>';
    elements.editor.focus();
    document.execCommand('insertHTML', false, html);
    scheduleSave();
}

function insertLink() {
    const url = window.prompt('Enter a link URL');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
        elements.saveStatus.textContent = 'Use a valid https:// or mailto: link';
        window.setTimeout(() => {
            if (elements.saveStatus.textContent === 'Use a valid https:// or mailto: link') {
                elements.saveStatus.textContent = 'Saved';
            }
        }, 3000);
        return;
    }
    elements.editor.focus();
    document.execCommand('createLink', false, url);
    scheduleSave();
}

function setSummaryButtonBusy(isBusy) {
    elements.summarizeButton.disabled = isBusy;
    elements.summarizeButton.classList.toggle('is-loading', isBusy);
    elements.summarizeButton.setAttribute('aria-busy', String(isBusy));
    elements.summarizeLabel.textContent = isBusy ? 'Working…' : 'Summarize';
}

function insertSummaryIntoContent(content, summary) {
    const container = document.createElement('div');
    container.innerHTML = sanitizeContent(content);
    container.querySelector('.notes-summary-draft')?.remove();

    const section = document.createElement('div');
    section.className = 'notes-summary-draft';
    const heading = document.createElement('h2');
    heading.textContent = 'AI summary';
    const paragraph = document.createElement('p');
    paragraph.textContent = summary;
    section.append(heading, paragraph);
    container.prepend(section);
    return sanitizeContent(container.innerHTML);
}

async function addSummaryDraft() {
    const note = notes.find((entry) => entry.id === selectedNoteId);
    const text = (elements.editor.innerText || '').trim();
    if (!note) return;
    if (!text) {
        showTransientStatus('Add note content before summarizing', true);
        return;
    }

    const requestId = ++summaryRequestId;
    const originalContent = note.content;
    setSummaryButtonBusy(true);
    elements.saveStatus.textContent = 'Summarizing…';
    elements.saveStatus.parentElement.classList.remove('is-error');

    try {
        const { response, data, ok } = await sendChatRequest({
            message: `Summarize this note in a few concise bullet points. Keep the note's language and preserve its key facts, decisions, and action items. Return only the summary.\n\n${text}`,
            model: state.currentModel,
            systemInstruction: 'You summarize user notes clearly and faithfully. Do not add information that is not in the note.',
        });
        if (!ok) throw new Error(data.error || `The AI service returned ${response.status}.`);
        const summary = typeof data.reply === 'string' ? data.reply.trim() : '';
        if (!summary) throw new Error('The AI service returned an empty summary.');
        if (requestId !== summaryRequestId || selectedNoteId !== note.id) return;
        if (note.content !== originalContent) throw new Error('The note changed while it was being summarized. Try again.');

        note.content = insertSummaryIntoContent(note.content, summary);
        note.updatedAt = new Date().toISOString();
        elements.editor.innerHTML = sanitizeContent(note.content);
        updateWordCount();
        renderCards();
        if (persistNotes()) showTransientStatus('Summary added');
    } catch (error) {
        if (requestId === summaryRequestId) showTransientStatus(error.message || 'Could not summarize this note.', true);
    } finally {
        if (requestId === summaryRequestId) setSummaryButtonBusy(false);
    }
}

let openNotesDropdown = null;

function setupNotesDropdown(select, label, format = false) {
    const control = select.parentElement;
    const button = document.createElement('button');
    const buttonLabel = document.createElement('span');
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const menu = document.createElement('div');
    const menuId = `${select.id}Menu`;
    let activeIndex = -1;

    button.type = 'button';
    button.className = 'notes-select-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', menuId);
    buttonLabel.className = 'notes-select-button-label';
    button.append(buttonLabel);
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.classList.add('notes-select-chevron');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'm6 9 6 6 6-6');
    chevron.append(chevronPath);
    button.append(chevron);
    control.insertBefore(button, select);

    menu.id = menuId;
    menu.className = 'notes-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', label);
    menu.hidden = true;
    document.body.append(menu);

    Array.from(select.options).forEach((option) => {
        // Keep the export placeholder on the trigger only; it is not a menu choice.
        if (format && option.disabled) return;

        const item = document.createElement('div');
        item.className = 'notes-select-option';
        item.setAttribute('role', 'option');
        item.dataset.value = option.value;
        item.setAttribute('aria-disabled', String(option.disabled));
        item.tabIndex = -1;

        if (format) {
            const badge = document.createElement('span');
            badge.className = 'notes-select-option-format';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = option.value.toUpperCase();
            item.append(badge);
        }

        const text = document.createElement('span');
        text.textContent = option.textContent;
        item.append(text);

        if (!format) {
            const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            check.setAttribute('viewBox', '0 0 20 20');
            check.setAttribute('fill', 'none');
            check.setAttribute('stroke', 'currentColor');
            check.setAttribute('stroke-width', '2');
            check.setAttribute('stroke-linecap', 'round');
            check.setAttribute('stroke-linejoin', 'round');
            check.setAttribute('aria-hidden', 'true');
            check.classList.add('notes-select-option-check');
            const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            checkPath.setAttribute('d', 'm4 10 4 4 8-8');
            check.append(checkPath);
            item.append(check);
        }

        item.addEventListener('click', () => {
            if (option.disabled) return;
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            syncSelection();
            close(true);
        });
        menu.append(item);
    });

    function syncSelection() {
        const selectedOption = select.options[select.selectedIndex];
        buttonLabel.textContent = selectedOption ? selectedOption.textContent : '';
        menu.querySelectorAll('.notes-select-option').forEach((item) => {
            const selectable = item.getAttribute('aria-disabled') !== 'true';
            item.setAttribute('aria-selected', String(selectable && item.dataset.value === select.value));
        });
    }

    function enabledItems() {
        return Array.from(menu.querySelectorAll('.notes-select-option'))
            .filter((item) => item.getAttribute('aria-disabled') !== 'true');
    }

    function focusItem(index) {
        const items = enabledItems();
        if (!items.length) return;
        activeIndex = Math.max(0, Math.min(index, items.length - 1));
        items[activeIndex].focus();
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function positionMenu() {
        const rect = button.getBoundingClientRect();
        const panel = elements.view.getBoundingClientRect();
        const bounds = {
            top: Math.max(8, panel.top),
            right: Math.min(window.innerWidth - 8, panel.right),
            bottom: Math.min(window.innerHeight - 8, panel.bottom),
            left: Math.max(8, panel.left),
        };
        const width = Math.min(
            Math.max(rect.width, format ? 164 : 112),
            Math.max(80, bounds.right - bounds.left - 16),
        );
        const spaceAbove = Math.max(0, rect.top - bounds.top - 8);
        const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - 8);
        const openUp = spaceAbove > spaceBelow;
        menu.style.width = `${width}px`;
        menu.style.maxHeight = `${Math.max(48, Math.min(220, openUp ? spaceAbove : spaceBelow))}px`;

        const height = menu.offsetHeight;
        const top = openUp ? rect.top - height - 6 : rect.bottom + 6;
        menu.style.left = `${Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - width - 8))}px`;
        menu.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - height - 8))}px`;
    }

    function onViewportChange() {
        if (!menu.hidden) positionMenu();
    }

    function close(returnFocus) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        window.removeEventListener('resize', onViewportChange);
        window.removeEventListener('scroll', onViewportChange, true);
        if (openNotesDropdown === close) openNotesDropdown = null;
        if (returnFocus) button.focus();
    }

    function open() {
        if (openNotesDropdown && openNotesDropdown !== close) openNotesDropdown(false);
        openNotesDropdown = close;
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        positionMenu();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);

        const selectedIndex = enabledItems().findIndex((item) => item.dataset.value === select.value);
        focusItem(selectedIndex < 0 ? 0 : selectedIndex);
    }

    button.addEventListener('click', () => {
        if (menu.hidden) open();
        else close(false);
    });
    button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (menu.hidden) open();
            else focusItem(event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1);
        } else if (event.key === 'Escape' && !menu.hidden) {
            event.preventDefault();
            close(true);
        }
    });
    menu.addEventListener('keydown', (event) => {
        const items = enabledItems();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusItem(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusItem(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            focusItem(items.length - 1);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            items[activeIndex]?.click();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close(true);
        } else if (event.key === 'Tab') {
            close(true);
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (!menu.hidden && !control.contains(event.target) && !menu.contains(event.target)) close(false);
    });
    select.addEventListener('change', syncSelection);
    syncSelection();
}

export function bindNotesInteractions() {
    if (notesBound || !elements.view) return;
    notesBound = true;

    setupNotesDropdown(elements.sort, 'Sort notes');
    setupNotesDropdown(elements.export, 'Export note', true);
    elements.folders.forEach((folder) => {
        folder.addEventListener('click', () => setFolder(folder.dataset.folder));
    });
    elements.search.addEventListener('input', renderCards);
    elements.sort.addEventListener('change', renderCards);
    elements.newButton.addEventListener('click', createNote);
    elements.emptyNewButton?.addEventListener('click', createNote);
    elements.backButton.addEventListener('click', () => elements.view.classList.remove('is-editor-open'));
    elements.title.addEventListener('input', scheduleSave);
    elements.editor.addEventListener('input', scheduleSave);
    elements.editor.addEventListener('change', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') scheduleSave();
    });
    elements.pinButton.addEventListener('click', togglePin);
    elements.archiveButton.addEventListener('click', toggleArchive);
    elements.deleteButton.addEventListener('click', openDeleteDialog);
    elements.deleteCancelButton.addEventListener('click', () => closeDeleteDialog());
    elements.deleteConfirmButton.addEventListener('click', deleteSelectedNote);
    elements.deleteDialog.addEventListener('click', (event) => {
        if (event.target === elements.deleteDialog) closeDeleteDialog();
    });
    elements.deleteDialog.addEventListener('keydown', handleDeleteDialogKeydown);
    elements.export.addEventListener('change', () => exportNote(elements.export.value));
    elements.summarizeButton.addEventListener('click', addSummaryDraft);
    elements.toolbar.querySelectorAll('button[data-format]').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
            const format = button.dataset.format;
            if (format === 'checklist') return insertChecklist();
            if (format === 'link') return insertLink();
            elements.editor.focus();
            const commands = {
                bold: ['bold'],
                italic: ['italic'],
                heading: ['formatBlock', 'h2'],
                bullet: ['insertUnorderedList'],
                highlight: ['hiliteColor', '#fff1bd'],
            };
            const [command, value] = commands[format] || [];
            if (command) document.execCommand(command, false, value);
            scheduleSave();
        });
    });

    renderFolderSelection();
    renderEditor();
    renderCards();
}
