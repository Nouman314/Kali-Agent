import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { sendGrammarFixRequest } from '../services/chatApi.js';

let grammarBound = false;
let isFixing = false;
let lastCorrectedText = '';

function trimModelArtifacts(text) {
    return text
        .split('\n')
        .filter(line => !/^\s*#{1,6}\s+(okay|done|corrected|result|success|complete|fixed)\s*$/i.test(line.trim()))
        .join('\n')
        .trim();
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatCleanText(text) {
    if (!text) return '';

    const processInlineStyles = (str) => {
        return escapeHtml(str)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>');
    };

    const renderParagraphBlock = (lines) => {
        const isBulletList = lines.every(line => /^\s*[-*•]\s+/.test(line));
        const isNumberedList = lines.every(line => /^\s*\d+\.\s+/.test(line));

        if (isBulletList) {
            const listItems = lines.map(line => {
                const itemText = line.replace(/^\s*[-*•]\s+/, '');
                return `<li>${processInlineStyles(itemText)}</li>`;
            }).join('');
            return `<ul class="grammar-clean-list">${listItems}</ul>`;
        }

        if (isNumberedList) {
            const listItems = lines.map(line => {
                const itemText = line.replace(/^\s*\d+\.\s+/, '');
                return `<li>${processInlineStyles(itemText)}</li>`;
            }).join('');
            return `<ol class="grammar-clean-list grammar-clean-list--ordered">${listItems}</ol>`;
        }

        const formattedContent = processInlineStyles(lines.join('\n')).replace(/\n/g, '<br>');
        return `<p class="grammar-clean-paragraph">${formattedContent}</p>`;
    };

    const lines = text.split('\n');
    const html = [];
    let buffer = [];

    const flushBuffer = () => {
        if (!buffer.length) return;
        html.push(renderParagraphBlock(buffer));
        buffer = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();

        if (!line) {
            flushBuffer();
            return;
        }

        const isHr = /^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line);
        if (isHr) {
            flushBuffer();
            html.push('<hr class="grammar-clean-hr">');
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushBuffer();
            const level = headingMatch[1].length;
            const headingText = headingMatch[2].trim();
            html.push(`<h${level} class="grammar-clean-heading">${processInlineStyles(headingText)}</h${level}>`);
            return;
        }

        buffer.push(line);
    });

    flushBuffer();

    return html.join('');
}

function diffWords(oldText, newText) {
    const oldTokens = oldText.split(/\s+/).filter(Boolean);
    const newTokens = newText.split(/\s+/).filter(Boolean);
    const n = oldTokens.length;
    const m = newTokens.length;

    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            dp[i][j] = oldTokens[i] === newTokens[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (oldTokens[i] === newTokens[j]) {
            ops.push({ type: 'equal', value: oldTokens[i] });
            i += 1;
            j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: 'remove', value: oldTokens[i] });
            i += 1;
        } else {
            ops.push({ type: 'add', value: newTokens[j] });
            j += 1;
        }
    }
    while (i < n) {
        ops.push({ type: 'remove', value: oldTokens[i] });
        i += 1;
    }
    while (j < m) {
        ops.push({ type: 'add', value: newTokens[j] });
        j += 1;
    }

    return ops;
}

function countChangeGroups(ops) {
    let count = 0;
    let inGroup = false;

    ops.forEach((op) => {
        if (op.type === 'equal') {
            inGroup = false;
            return;
        }
        if (!inGroup) {
            count += 1;
            inGroup = true;
        }
    });

    return count;
}

function renderDiffHtml(ops) {
    return ops
        .map((op) => {
            const safe = escapeHtml(op.value);
            if (op.type === 'remove') return `<del class="grammar-diff-del">${safe}</del>`;
            if (op.type === 'add') return `<ins class="grammar-diff-ins">${safe}</ins>`;
            return safe;
        })
        .join(' ');
}

function showGrammarError(message) {
    if (!dom.grammarError) return;

    if (!message) {
        dom.grammarError.hidden = true;
        dom.grammarError.textContent = '';
        return;
    }

    dom.grammarError.textContent = message;
    dom.grammarError.hidden = false;
}

function updateCounter() {
    if (!dom.grammarCounter || !dom.grammarInput) return;

    const value = dom.grammarInput.value;
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = value.length;

    dom.grammarCounter.textContent = `${words} word${words === 1 ? '' : 's'} · ${chars} character${chars === 1 ? '' : 's'}`;
    dom.grammarCounter.classList.toggle('is-over-limit', chars > CONFIG.GRAMMAR.MAX_CHARS);
}

function setFixButtonLoading(loading) {
    isFixing = loading;
    if (!dom.grammarFixBtn) return;

    dom.grammarFixBtn.disabled = loading;
    dom.grammarFixBtn.classList.toggle('is-loading', loading);
    dom.grammarFixBtn.querySelector('.grammar-fix-btn__label').textContent = loading ? 'Fixing…' : 'Fix Grammar';
}

function setActiveTab(tabName) {
    dom.grammarTabs?.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tabName));
    if (dom.grammarDiffPanel) dom.grammarDiffPanel.hidden = tabName !== 'diff';
    if (dom.grammarCleanPanel) dom.grammarCleanPanel.hidden = tabName !== 'clean';
}

function renderGrammarResult(original, corrected) {
    const cleanCorrected = trimModelArtifacts(corrected);
    lastCorrectedText = cleanCorrected;

    const ops = diffWords(original, cleanCorrected);
    const changeCount = countChangeGroups(ops);

    if (dom.grammarDiffPanel) {
        dom.grammarDiffPanel.innerHTML = changeCount
            ? renderDiffHtml(ops)
            : '<p class="grammar-no-changes">No issues found — your text looks great!</p>';
    }

    if (dom.grammarCleanPanel) {
        dom.grammarCleanPanel.innerHTML = formatCleanText(cleanCorrected);
    }

    if (dom.grammarChangesCount) {
        dom.grammarChangesCount.textContent = changeCount
            ? `${changeCount} change${changeCount === 1 ? '' : 's'} found`
            : 'No changes needed';
    }

    if (dom.grammarResult) dom.grammarResult.hidden = false;

    setActiveTab('diff');
}

async function handleFixClick() {
    if (isFixing || !dom.grammarInput) return;

    const text = dom.grammarInput.value.trim();
    if (!text) {
        showGrammarError('Please enter some text to check.');
        return;
    }

    if (text.length > CONFIG.GRAMMAR.MAX_CHARS) {
        showGrammarError(`Text is too long (max ${CONFIG.GRAMMAR.MAX_CHARS} characters).`);
        return;
    }

    showGrammarError('');
    setFixButtonLoading(true);

    try {
        const { data, ok } = await sendGrammarFixRequest({ text });

        if (!ok) {
            showGrammarError(data.error || 'Something went wrong. Please try again.');
            return;
        }

        renderGrammarResult(text, data.corrected || text);
    } catch (err) {
        showGrammarError('Could not reach the backend. Is server.py running?');
        console.error('[Kali Agent] Grammar fix error:', err);
    } finally {
        setFixButtonLoading(false);
    }
}

async function handleCopyClick() {
    const text = lastCorrectedText || dom.grammarCleanPanel?.textContent || '';
    if (!text || !dom.grammarCopyBtn) return;

    const svg = dom.grammarCopyBtn.querySelector('svg');
    const originalSVG = svg?.innerHTML || '';

    try {
        await navigator.clipboard.writeText(text);

        if (svg) {
            svg.innerHTML = '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>';
            svg.style.stroke = '#22c55e';
        }

        dom.grammarCopyBtn.classList.add('is-copied');
        dom.grammarCopyBtn.setAttribute('data-tooltip', 'Copied!');
        setTimeout(() => {
            if (svg) {
                svg.innerHTML = originalSVG;
                svg.style.stroke = '';
            }
            dom.grammarCopyBtn.classList.remove('is-copied');
            dom.grammarCopyBtn.setAttribute('data-tooltip', 'Copy');
        }, 1500);
    } catch {
        showGrammarError('Could not copy to clipboard.');
    }
}

function handleTabClick(event) {
    const tab = event.target.closest('.grammar-tab');
    if (!tab) return;
    setActiveTab(tab.dataset.tab);
}

function handleInputKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleFixClick();
    }
}

export function bindGrammarInteractions() {
    if (grammarBound) return;
    grammarBound = true;

    dom.grammarInput?.addEventListener('input', updateCounter);
    dom.grammarInput?.addEventListener('keydown', handleInputKeydown);
    dom.grammarFixBtn?.addEventListener('click', handleFixClick);
    dom.grammarCopyBtn?.addEventListener('click', handleCopyClick);
    dom.grammarResult?.addEventListener('click', handleTabClick);

    if (dom.grammarResult) dom.grammarResult.hidden = true;
    updateCounter();
}
