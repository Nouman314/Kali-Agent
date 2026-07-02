// Shared text-to-HTML formatting helpers.
// Originally lived only in features/grammar.js — pulled out so any feature
// (grammar fixer, workspace file preview, etc.) can render the same
// "clean" reading view: headings, bold, bullet/numbered lists, and
// paragraphs, instead of a raw <pre> dump.

export function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function formatCleanText(text) {
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