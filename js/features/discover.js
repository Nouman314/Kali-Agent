import { dom } from '../dom.js';
import { sendMessage } from './messages.js';
import { goToChat } from './navigation.js';

let discoverBound = false;
let activeFilter = 'all';
let searchTerm = '';

function icon(paths) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
    work: icon('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    writing: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    code: icon('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    ideas: icon('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'),
};

const PROMPTS = [
    { id: 'summarize', category: 'work', title: 'Summarize a document', desc: 'Condense a long document into key points.', prompt: 'Summarize this document for me in 3 bullet points.' },
    { id: 'action-items', category: 'work', title: 'Turn notes into action items', desc: 'Convert rough notes into a clear task list.', prompt: 'Turn these meeting notes into a clear action item list:\n\n' },
    { id: 'status-update', category: 'work', title: 'Write a status update', desc: 'Summarize progress for a team or manager.', prompt: 'Write a short weekly status update based on this progress: ' },
    { id: 'email', category: 'writing', title: 'Draft a professional email', desc: 'Write a clear, polite email from a quick description.', prompt: 'Write a short, professional email about: ' },
    { id: 'rewrite', category: 'writing', title: 'Rewrite for clarity', desc: 'Tighten up wording and tone.', prompt: 'Rewrite the following text to be clearer and more concise:\n\n' },
    { id: 'review-code', category: 'code', title: 'Review my code', desc: 'Get feedback on quality, bugs, and style.', prompt: 'Review this code and suggest improvements:\n\n' },
    { id: 'explain-code', category: 'code', title: 'Explain this code', desc: 'Get a plain-language walkthrough.', prompt: 'Explain what this code does, step by step:\n\n' },
    { id: 'brainstorm', category: 'ideas', title: 'Brainstorm ideas', desc: 'Generate options on any topic.', prompt: 'Brainstorm 5 ideas for: ' },
    { id: 'name-it', category: 'ideas', title: 'Find a name', desc: 'Get naming suggestions with reasoning.', prompt: 'Suggest 5 names for a project about: ' },
];

function matchesFilter(item) {
    const inCategory = activeFilter === 'all' || item.category === activeFilter;
    if (!inCategory) return false;
    if (!searchTerm) return true;
    return `${item.title} ${item.desc}`.toLowerCase().includes(searchTerm);
}

function insertPrompt(text) {
    if (!dom.inputBox) return;
    dom.inputBox.value = text;
    dom.inputBox.focus();
    dom.inputBox.dispatchEvent(new Event('input'));
}

function sendPromptNow(text) {
    insertPrompt(text);
    goToChat();
    sendMessage();
}

function createCard(item) {
    const card = document.createElement('article');
    card.className = 'discover-card';
    card.dataset.promptId = item.id;

    card.innerHTML = `
        <div class="discover-card-top">
            <div class="discover-card-icon">${ICONS[item.category] || ICONS.ideas}</div>
            <span class="discover-card-tag">${item.category}</span>
        </div>
        <span class="discover-card-title">${item.title}</span>
        <span class="discover-card-desc">${item.desc}</span>
        <div class="discover-card-actions">
            <button type="button" class="discover-card-action" data-action="insert">Insert</button>
            <button type="button" class="discover-card-action discover-card-action--primary" data-action="send">Send now</button>
        </div>`;

    return card;
}

function renderGrid() {
    if (!dom.discoverGrid) return;

    const filtered = PROMPTS.filter(matchesFilter);
    dom.discoverGrid.innerHTML = '';
    filtered.forEach((item) => dom.discoverGrid.appendChild(createCard(item)));

    if (dom.discoverEmpty) dom.discoverEmpty.hidden = filtered.length !== 0;
    if (dom.discoverCount) {
        dom.discoverCount.textContent = `${filtered.length} prompt${filtered.length === 1 ? '' : 's'}`;
    }
}

function handleGridClick(event) {
    const card = event.target.closest('.discover-card');
    if (!card) return;

    const item = PROMPTS.find((entry) => entry.id === card.dataset.promptId);
    if (!item) return;

    const action = event.target.closest('.discover-card-action')?.dataset.action || 'insert';

    if (action === 'send') {
        sendPromptNow(item.prompt);
    } else {
        insertPrompt(item.prompt);
        goToChat();
    }
}

function handleFilterClick(event) {
    const button = event.target.closest('.discover-filter');
    if (!button) return;

    dom.discoverFilters.forEach((btn) => btn.classList.toggle('is-active', btn === button));
    activeFilter = button.dataset.filter || 'all';
    renderGrid();
}

function handleSearchInput(event) {
    searchTerm = event.target.value.trim().toLowerCase();
    renderGrid();
}

function handleShuffle() {
    const grid = dom.discoverGrid;
    if (!grid || grid.children.length < 2) return;

    const cards = Array.from(grid.children);
    for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards.forEach((card) => grid.appendChild(card));
}

function resetFilters() {
    activeFilter = 'all';
    searchTerm = '';
    if (dom.discoverSearch) dom.discoverSearch.value = '';
    dom.discoverFilters.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.filter === 'all'));
    renderGrid();
}

export function bindDiscoverInteractions() {
    if (discoverBound) return;
    discoverBound = true;

    dom.discoverGrid?.addEventListener('click', handleGridClick);
    dom.discoverFilters?.forEach((btn) => btn.addEventListener('click', handleFilterClick));
    dom.discoverSearch?.addEventListener('input', handleSearchInput);
    dom.discoverShuffleBtn?.addEventListener('click', handleShuffle);
    dom.discoverResetBtn?.addEventListener('click', resetFilters);

    renderGrid();
}
