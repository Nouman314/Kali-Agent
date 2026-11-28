const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_SVG_CHARS = 50000;
const MAX_SVG_ELEMENTS = 1000;
const MAX_IMAGE_DIMENSION = 2048;
const DRAWING_ELEMENTS = new Set([
    'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan',
]);
const SVG_ELEMENTS = new Set([
    'svg', 'g', 'defs', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
    'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'filter',
    'feGaussianBlur', 'feOffset', 'feBlend', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode',
    'feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA',
    'text', 'tspan', 'title', 'desc',
]);
const SVG_ATTRIBUTES = new Set([
    'id', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
    'width', 'height', 'viewBox', 'preserveAspectRatio', 'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'transform', 'offset', 'stop-color',
    'stop-opacity', 'clip-path', 'mask', 'filter', 'gradientUnits', 'gradientTransform',
    'clipPathUnits', 'maskUnits',
    'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'filterUnits',
    'primitiveUnits', 'stdDeviation', 'in', 'in2', 'result', 'type', 'values', 'operator', 'mode',
    'k1', 'k2', 'k3', 'k4', 'text-anchor', 'dominant-baseline', 'font-family', 'font-size',
    'font-weight', 'letter-spacing', 'dx', 'dy', 'rotate', 'flood-color', 'flood-opacity',
    'color-interpolation-filters', 'edgeMode', 'scale', 'xChannelSelector', 'yChannelSelector',
]);
const LOCAL_REFERENCE_ATTRIBUTES = new Set([
    'fill', 'stroke', 'clip-path', 'mask', 'filter',
]);
const SVG_FENCE_PATTERN = /```svg[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi;

function parseViewBox(value) {
    if (!value) return null;
    const values = value.trim().split(/[ ,]+/).map(Number);
    if (values.length !== 4 || values.some((entry) => !Number.isFinite(entry))) return null;
    if (values.some((entry) => Math.abs(entry) > 1000000) || values[2] <= 0 || values[3] <= 0) return null;
    return values;
}

function readDimension(value, fallback) {
    const fallbackDimension = Math.min(MAX_IMAGE_DIMENSION, Math.max(1, fallback));
    const match = value?.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
    if (!match) return fallbackDimension;
    const dimension = Number(match[1]);
    return dimension > 0 && dimension <= MAX_IMAGE_DIMENSION ? dimension : fallbackDimension;
}

function sanitizeElement(source, counter) {
    if (
        (source.namespaceURI !== SVG_NAMESPACE && source.namespaceURI !== null) ||
        !SVG_ELEMENTS.has(source.localName)
    ) return null;
    counter.count += 1;
    if (counter.count > MAX_SVG_ELEMENTS) {
        throw new Error('The image contains too many vector elements.');
    }

    const element = document.createElementNS(SVG_NAMESPACE, source.localName);
    if (DRAWING_ELEMENTS.has(source.localName)) counter.drawings += 1;
    for (const attribute of source.attributes) {
        if (!SVG_ATTRIBUTES.has(attribute.name) || attribute.value.length > 2000) continue;

        const value = attribute.value.trim();
        if (attribute.name === 'id' && !/^[A-Za-z_][\w.-]*$/.test(value)) continue;
        if (LOCAL_REFERENCE_ATTRIBUTES.has(attribute.name) && /url\s*\(/i.test(value) &&
            !/^url\(\s*#[A-Za-z_][\w.-]*\s*\)$/.test(value)) {
            continue;
        }
        element.setAttribute(attribute.name, value);
    }

    for (const child of source.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const sanitizedChild = sanitizeElement(child, counter);
            if (sanitizedChild) element.appendChild(sanitizedChild);
        } else if (
            child.nodeType === Node.TEXT_NODE &&
            ['text', 'tspan', 'title', 'desc'].includes(source.localName)
        ) {
            element.appendChild(document.createTextNode(child.nodeValue || ''));
        }
    }

    return element;
}

function sanitizeSvg(source) {
    if (source.length > MAX_SVG_CHARS) {
        throw new Error('The image markup is too large to preview.');
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
        throw new Error('The image contains unsupported XML declarations.');
    }

    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = parsed.documentElement;
    if (
        parsed.querySelector('parsererror') ||
        root.localName !== 'svg' ||
        (root.namespaceURI !== SVG_NAMESPACE && root.namespaceURI !== null)
    ) {
        throw new Error('The response did not contain valid SVG markup.');
    }

    const originalViewBox = parseViewBox(root.getAttribute('viewBox'));
    const width = readDimension(root.getAttribute('width'), originalViewBox?.[2] || 1024);
    const height = readDimension(root.getAttribute('height'), originalViewBox?.[3] || 768);
    const pixelWidth = Math.max(1, Math.round(width));
    const pixelHeight = Math.max(1, Math.round(height));
    const counter = { count: 0, drawings: 0 };
    const safeRoot = sanitizeElement(root, counter);
    if (!counter.drawings) {
        throw new Error('The SVG does not contain any supported shapes or text.');
    }
    safeRoot.setAttribute('width', String(pixelWidth));
    safeRoot.setAttribute('height', String(pixelHeight));
    safeRoot.setAttribute('viewBox', originalViewBox
        ? originalViewBox.join(' ')
        : `0 0 ${width} ${height}`);

    return {
        markup: new XMLSerializer().serializeToString(safeRoot),
        width: pixelWidth,
        height: pixelHeight,
    };
}

function createDownloadButton(svg, width, height, filename) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'generated-image-download';
    button.textContent = 'Download PNG';

    button.addEventListener('click', async () => {
        const status = button.closest('.generated-image-card')?.querySelector('.generated-image-status');
        button.disabled = true;
        if (status) status.textContent = 'Preparing PNG…';

        let svgUrl = '';
        let pngUrl = '';
        try {
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            svgUrl = URL.createObjectURL(svgBlob);
            const image = new Image();
            image.src = svgUrl;
            await image.decode();

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas is unavailable.');
            context.drawImage(image, 0, 0, width, height);

            const pngBlob = await new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('PNG export is unavailable.'));
                }, 'image/png');
            });
            pngUrl = URL.createObjectURL(pngBlob);

            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = filename;
            link.click();
            if (status) status.textContent = `${filename} export started.`;
        } catch (error) {
            console.error('[Kali Agent] Could not export generated image:', error);
            if (status) status.textContent = `Could not export PNG: ${error.message || 'Image conversion failed.'}`;
        } finally {
            button.disabled = false;
            if (svgUrl) URL.revokeObjectURL(svgUrl);
            if (pngUrl) window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        }
    });

    return button;
}

function createImageCard(svg, index, width, height) {
    const filename = index === 1 ? 'image.png' : `image-${index}.png`;
    const card = document.createElement('section');
    card.className = 'generated-image-card';

    const header = document.createElement('div');
    header.className = 'generated-image-header';

    const title = document.createElement('span');
    title.className = 'generated-image-filename';
    title.textContent = filename;
    header.append(title, createDownloadButton(svg, width, height, filename));

    const preview = document.createElement('img');
    preview.className = 'generated-image-preview';
    preview.alt = `Preview of ${filename}`;
    preview.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const status = document.createElement('span');
    status.className = 'generated-image-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    card.append(header, preview, status);
    return card;
}

export function appendGeneratedImageArtifacts(bubble, reply) {
    SVG_FENCE_PATTERN.lastIndex = 0;
    const imageBlocks = Array.from(reply.matchAll(SVG_FENCE_PATTERN));
    if (!imageBlocks.length) return;

    imageBlocks.forEach((match, index) => {
        try {
            const image = sanitizeSvg(match[1]);
            bubble.appendChild(createImageCard(image.markup, index + 1, image.width, image.height));
        } catch (error) {
            console.warn('[Kali Agent] Could not prepare generated SVG:', error);
            const status = document.createElement('p');
            status.className = 'generated-image-error';
            status.setAttribute('role', 'status');
            status.textContent = `Could not prepare image preview: ${error.message || 'Invalid SVG.'}`;
            bubble.appendChild(status);
        }
    });
}
