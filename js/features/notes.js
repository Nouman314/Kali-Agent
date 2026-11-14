const STORAGE_KEY = 'kali_notes';

const INITIAL_CONTENT = `
    <h2>How cells maintain balance</h2>
    <p>Homeostasis is the ability of a cell to keep its internal environment stable while conditions outside continue to change. The cell membrane is selectively permeable, so it controls which substances enter and leave. Understanding this balance makes it easier to explain how cells stay healthy, communicate, and respond to their surroundings.</p>
    <ul>
        <li><strong>Diffusion:</strong> particles move from an area of higher concentration to an area of lower concentration.</li>
        <li><strong>Osmosis:</strong> water crosses a selectively permeable membrane toward the side with more dissolved particles.</li>
        <li><strong>Active transport:</strong> membrane proteins use energy to move substances against a concentration gradient.</li>
    </ul>
    <h3>Quick review</h3>
    <div class="notes-checklist">
        <div class="notes-checklist-item"><input type="checkbox" checked><span contenteditable="true">Compare passive and active transport using energy as the key difference.</span></div>
        <div class="notes-checklist-item"><input type="checkbox"><span contenteditable="true">Draw a diagram showing water moving across a membrane.</span></div>
        <div class="notes-checklist-item"><input type="checkbox"><span contenteditable="true">Review how concentration gradients affect the direction of movement.</span></div>
    </div>
    <p>When a cell is placed in a solution with a different concentration, water moves until the difference is reduced. In a balanced solution, water still moves in both directions, but the overall movement is equal. This is called dynamic equilibrium: the system is active even when there is no visible net change.</p>
    <p>For exam questions, identify the starting concentrations first, then name the membrane process and predict the direction of movement. Remember that cells use energy for active transport, while diffusion and osmosis are passive. Linking the direction of movement to the concentration gradient is a reliable way to explain the result clearly. Sketch each process to connect the definitions with familiar classroom examples, and remember which processes need energy.</p>
`;

const INITIAL_NOTES = [
    {
        id: 'cell-biology-review',
        title: 'Cell Biology — exam review',
        folder: 'study',
        source: 'chat',
        tags: ['Biology', 'Exam'],
        pinned: true,
        archived: false,
        updatedAt: '2026-11-14T10:20:00.000Z',
        content: INITIAL_CONTENT,
    },
    {
        id: 'design-sync',
        title: 'Design sync — meeting notes',
        folder: 'work',
        source: 'web',
        tags: ['Meeting', 'Team'],
        pinned: false,
        archived: false,
        updatedAt: '2026-11-13T14:15:00.000Z',
        content: '<h2>Design sync</h2><p>Align on the student onboarding flow, review open questions, and share next steps with the team.</p><ul><li>Keep the first-run experience simple.</li><li>Test the updated navigation with students.</li><li>Share final copy before Friday.</li></ul>',
    },
    {
        id: 'enzyme-lab',
        title: 'Enzyme activity — lab notes',
        folder: 'work',
        source: 'file',
        tags: ['Chemistry', 'Lab'],
        pinned: false,
        archived: false,
        updatedAt: '2026-11-12T09:30:00.000Z',
        content: '<h2>Enzyme activity</h2><p>Record the temperature and pH for each sample before comparing reaction rates. Keep the control conditions consistent.</p><ul><li>Label each test tube clearly.</li><li>Repeat measurements for reliability.</li><li>Graph the average reaction time.</li></ul>',
    },
    {
        id: 'membrane-transport',
        title: 'Membrane transport — quick recap',
        folder: 'chat',
        source: 'chat',
        tags: ['Biology', 'Review'],
        pinned: false,
        archived: false,
        updatedAt: '2026-11-10T16:05:00.000Z',
        content: '<h2>Transport at a glance</h2><p>Diffusion and osmosis move down a concentration gradient without added energy. Active transport moves against the gradient and uses energy from the cell.</p>',
    },
    {
        id: 'climate-reading-list',
        title: 'Climate & health — reading list',
        folder: 'work',
        source: 'web',
        tags: ['Research', 'Health'],
        pinned: false,
        archived: true,
        updatedAt: '2026-11-07T08:45:00.000Z',
        content: '<h2>Climate and health</h2><p>Collect sources on heat exposure, public health, and community adaptation for the research brief.</p>',
    },
];

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
let selectedNoteId = notes.find((note) => !note.archived)?.id || null;
let saveTimer = null;
let notesBound = false;

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
    backButton: document.querySelector('#notesBackBtn'),
    source: document.querySelector('#notesEditorSource'),
    pinButton: document.querySelector('#notesPinBtn'),
    archiveButton: document.querySelector('#notesArchiveBtn'),
    title: document.querySelector('#notesTitleInput'),
    editor: document.querySelector('#notesEditorBody'),
    toolbar: document.querySelector('.notes-editor-toolbar'),
    summarizeButton: document.querySelector('#notesSummarizeBtn'),
    saveStatus: document.querySelector('#notesSaveStatus'),
    wordCount: document.querySelector('#notesWordCount'),
    export: document.querySelector('#notesExport'),
};

function loadNotes() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return INITIAL_NOTES.map((note) => ({ ...note }));
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new TypeError('Saved notes must be an array');
        return parsed.filter((note) => note && typeof note.id === 'string').map((note) => ({
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
        return INITIAL_NOTES.map((note) => ({ ...note }));
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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        elements.saveStatus.textContent = 'Saved';
        elements.saveStatus.parentElement.classList.remove('is-error');
    } catch (error) {
        console.error('[Kali Agent] Failed to save notes:', error);
        elements.saveStatus.textContent = 'Not saved';
        elements.saveStatus.parentElement.classList.add('is-error');
    }
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
        selectedNoteId = visibleNotes[0]?.id || null;
        if (selectedNoteId) renderEditor();
        else clearEditor();
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

    elements.title.value = note.title;
    elements.editor.innerHTML = sanitizeContent(note.content);
    elements.source.textContent = note.source === 'chat' ? 'Saved from chat' : note.source === 'web' ? 'Saved from web' : 'Saved from file';
    elements.pinButton.classList.toggle('is-active', note.pinned);
    elements.pinButton.setAttribute('aria-pressed', String(note.pinned));
    elements.pinButton.setAttribute('aria-label', note.pinned ? 'Unpin note' : 'Pin note');
    elements.pinButton.title = note.pinned ? 'Unpin note' : 'Pin note';
    elements.archiveButton.setAttribute('aria-label', note.archived ? 'Restore note' : 'Archive note');
    elements.archiveButton.title = note.archived ? 'Restore note' : 'Archive note';
    updateWordCount();
}

function clearEditor() {
    elements.title.value = '';
    elements.editor.replaceChildren();
    elements.source.textContent = 'No note selected';
    elements.pinButton.classList.remove('is-active');
    elements.pinButton.setAttribute('aria-pressed', 'false');
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
    persistNotes();
    renderFolderSelection();
    renderCards();
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
    } else {
        elements.saveStatus.textContent = 'DOCX export is not available yet';
        window.setTimeout(() => {
            if (elements.saveStatus.textContent === 'DOCX export is not available yet') {
                elements.saveStatus.textContent = 'Saved';
            }
        }, 3000);
    }

    elements.export.value = '';
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

function addSummaryDraft() {
    const text = (elements.editor.innerText || '').trim();
    if (!text) {
        elements.saveStatus.textContent = 'Add note content before summarizing';
        return;
    }
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const summary = sentences.slice(0, 3).join(' ');
    const existing = elements.editor.querySelector('[data-summary-draft]');
    existing?.remove();

    const section = document.createElement('div');
    section.className = 'notes-summary-draft';
    section.innerHTML = `<h2>Quick summary draft</h2><p>${escapeHtml(summary)}</p>`;
    elements.editor.prepend(section);
    elements.saveStatus.textContent = 'Summary draft added';
    scheduleSave();
}

export function bindNotesInteractions() {
    if (notesBound || !elements.view) return;
    notesBound = true;

    elements.folders.forEach((folder) => {
        folder.addEventListener('click', () => setFolder(folder.dataset.folder));
    });
    elements.search.addEventListener('input', renderCards);
    elements.sort.addEventListener('change', renderCards);
    elements.newButton.addEventListener('click', createNote);
    elements.backButton.addEventListener('click', () => elements.view.classList.remove('is-editor-open'));
    elements.title.addEventListener('input', scheduleSave);
    elements.editor.addEventListener('input', scheduleSave);
    elements.editor.addEventListener('change', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') scheduleSave();
    });
    elements.pinButton.addEventListener('click', togglePin);
    elements.archiveButton.addEventListener('click', toggleArchive);
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
