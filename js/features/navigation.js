import { dom } from '../dom.js';

let navigationBound = false;

function setActive(element) {
    dom.rightNav?.querySelectorAll('.nav-item[data-nav-item]').forEach((item) => {
        item.classList.remove('active');
    });

    element.classList.add('active');
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
}

export function bindNavigation() {
    if (navigationBound) return;
    navigationBound = true;

    dom.rightNav?.addEventListener('click', handleNavClick);
    dom.rightNav?.addEventListener('keydown', handleNavKeydown);
    dom.sidebarToggleBtn?.addEventListener('click', toggleSidebar);
}
