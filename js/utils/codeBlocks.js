const LANGUAGE_LABELS = {
    bash: 'Shell',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    css: 'CSS',
    html: 'HTML',
    js: 'JavaScript',
    javascript: 'JavaScript',
    json: 'JSON',
    md: 'Markdown',
    plaintext: 'Plain text',
    py: 'Python',
    python: 'Python',
    sh: 'Shell',
    sql: 'SQL',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    txt: 'Plain text',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
};

function getLanguageLabel(code) {
    const languageClass = Array.from(code.classList).find((className) =>
        className.startsWith('language-') || className.startsWith('lang-')
    );
    const language = languageClass?.replace(/^(language|lang)-/, '').toLowerCase();
    if (!language) return 'Code';
    return LANGUAGE_LABELS[language] || language.charAt(0).toUpperCase() + language.slice(1);
}

function createCopyButton(code) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-block-copy';
    button.setAttribute('aria-label', 'Copy code');
    button.title = 'Copy code';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.8');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>';

    const label = document.createElement('span');
    label.textContent = 'Copy code';
    label.setAttribute('aria-live', 'polite');
    button.append(icon, label);

    button.addEventListener('click', async () => {
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard access is unavailable.');
            }
            await navigator.clipboard.writeText(code.textContent || '');
            label.textContent = 'Copied!';
            button.setAttribute('aria-label', 'Code copied');
            button.title = 'Code copied';
            button.classList.add('is-copied');
        } catch (error) {
            console.warn('[Kali Agent] Could not copy code block:', error);
            label.textContent = 'Copy failed';
            button.setAttribute('aria-label', 'Could not copy code');
            button.title = 'Could not copy code';
            button.classList.add('is-copy-failed');
        }

        window.setTimeout(() => {
            label.textContent = 'Copy code';
            button.setAttribute('aria-label', 'Copy code');
            button.title = 'Copy code';
            button.classList.remove('is-copied', 'is-copy-failed');
        }, 1600);
    });

    return button;
}

function decorateCodeBlock(code) {
    if (code.closest('.chat-code-block')) return;

    const pre = code.closest('pre');
    if (!pre) return;

    if (globalThis.hljs) {
        globalThis.hljs.highlightElement(code);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-code-block';

    const toolbar = document.createElement('div');
    toolbar.className = 'code-block-toolbar';

    const language = document.createElement('span');
    language.className = 'code-block-language';
    language.textContent = getLanguageLabel(code);

    toolbar.append(language, createCopyButton(code));
    pre.replaceWith(wrapper);
    wrapper.append(toolbar, pre);
}

export function enhanceCodeBlocks(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('pre code').forEach(decorateCodeBlock);
}
