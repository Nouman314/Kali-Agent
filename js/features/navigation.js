import { dom } from '../dom.js';

let navigationBound = false;

const VIEW_MAP = {
    chat: dom.chatView,
    discover: dom.discoverView,
};

function showView(name) {
    Object.entries(VIEW_MAP).forEach(([key, el]) => {
        if (el) el.hidden = key !== name;
    });
}

function setActive(element) {
    if (!element) return;

    dom.rightNav?.querySelectorAll('.nav-item[data-nav-item]').forEach((item) => {
        item.classList.remove('active');
    });

    element.classList.add('active');

    const navKey = element.getAttribute('data-nav-item');
    if (VIEW_MAP[navKey]) {
        showView(navKey);
    }
}

function handleNavClick(event) {
    const item = event.target.closest('.nav-item[data-nav-item]');
    if (!item || !dom.rightNav?.contains(item)) return;

    setActive(item);
}

function handleNavKeydown(event) {
    const item = event.target.closest('.nav-item[data-nav-item]');
    if (!item || !dom.rightNav?.contains(item)) return;

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setActive(item);
    }
}

function handleDiscoverCardClick(event) {
    const card = event.target.closest('.discover-card');
    if (!card) return;

    const prompt = card.getAttribute('data-prompt') || '';
    if (dom.inputBox) {
        dom.inputBox.value = prompt;
        dom.inputBox.focus();
        dom.inputBox.dispatchEvent(new Event('input'));
    }

    const chatNavItem = dom.rightNav?.querySelector('[data-nav-item="chat"]');
    if (chatNavItem) setActive(chatNavItem);
}

function toggleSidebar() {
    if (!dom.sidebarShell || !dom.sidebarToggleBtn) return;

    const isCollapsed = dom.sidebarShell.classList.toggle('sidebar-collapsed');
    dom.sidebarToggleBtn.setAttribute('aria-pressed', String(isCollapsed));
    dom.sidebarToggleBtn.setAttribute('data-tooltip', isCollapsed ? 'Show sidebar' : 'Hide sidebar');
}

export function bindNavigation() {
    if (navigationBound) return;
    navigationBound = true;

    dom.rightNav?.addEventListener('click', handleNavClick);
    dom.rightNav?.addEventListener('keydown', handleNavKeydown);
    dom.sidebarToggleBtn?.addEventListener('click', toggleSidebar);
    dom.discoverView?.addEventListener('click', handleDiscoverCardClick);
}
