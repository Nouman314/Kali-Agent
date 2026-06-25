import { dom } from '../dom.js';

let navigationBound = false;

const VIEW_MAP = {
    chat: dom.chatView,
    grammar: dom.grammarView,
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

function toggleSidebar() {
    if (!dom.sidebarShell || !dom.sidebarToggleBtn) return;

    const isCollapsed = dom.sidebarShell.classList.toggle('sidebar-collapsed');
    dom.sidebarToggleBtn.setAttribute('aria-pressed', String(isCollapsed));
    dom.sidebarToggleBtn.setAttribute('data-tooltip', isCollapsed ? 'Show sidebar' : 'Hide sidebar');

    const arrowPath = dom.sidebarToggleBtn.querySelector('svg path:last-child');
    if (arrowPath) {
        arrowPath.setAttribute('d', isCollapsed ? 'M13.5 10l2 2l-2 2' : 'M15.5 10l-2 2l2 2');
    }
}

function toggleUserMenu() {
    if (!dom.avatarBtn || !dom.userMenu) return;
    const isVisible = !dom.userMenu.hidden;
    dom.userMenu.hidden = isVisible;
    dom.sidebarShell?.classList.toggle('user-menu-open', !isVisible);
}

function closeUserMenu() {
    if (dom.userMenu) dom.userMenu.hidden = true;
    dom.sidebarShell?.classList.remove('user-menu-open');
}

export function goToChat() {
    const chatItem = dom.rightNav?.querySelector('[data-nav-item="chat"]');
    if (chatItem) setActive(chatItem);
}

export function bindNavigation() {
    if (navigationBound) return;
    navigationBound = true;

    dom.rightNav?.addEventListener('click', handleNavClick);
    dom.rightNav?.addEventListener('keydown', handleNavKeydown);
    dom.sidebarToggleBtn?.addEventListener('click', toggleSidebar);
    if (dom.avatarBtn) {
        dom.avatarBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleUserMenu();
        });
    }

    document.addEventListener('click', (event) => {
        if (!dom.userMenu?.hidden) {
            closeUserMenu();
        }
    });
}