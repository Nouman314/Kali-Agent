const inputBox = document.querySelector('.input-box');
const inputWrapper = document.querySelector('.input-box-wrapper');
let isResizing = false;
let startY = 0;
let startHeight = 0;

inputBox.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

inputBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function updateResizeCursor(e) {
    if (isResizing) return;
    const rect = inputWrapper.getBoundingClientRect();
    const isTopEdge = e.clientY - rect.top < 8;
    const cursor = isTopEdge ? 'ns-resize' : 'text';
    inputWrapper.style.cursor = cursor;
    inputBox.style.cursor = cursor;
}

function tryStartResize(e) {
    const rect = inputWrapper.getBoundingClientRect();
    const isTopEdge = e.clientY - rect.top < 8;

    if (isTopEdge) {
        isResizing = true;
        startY = e.clientY;
        startHeight = inputBox.getBoundingClientRect().height;
        e.preventDefault();
    }
}

inputWrapper.addEventListener('mousemove', updateResizeCursor);
inputBox.addEventListener('mousemove', updateResizeCursor);

inputWrapper.addEventListener('mousedown', tryStartResize);
inputBox.addEventListener('mousedown', tryStartResize);

document.addEventListener('mousemove', function (e) {
    if (!isResizing) return;

    const delta = startY - e.clientY;
    let newHeight = startHeight + delta;
    const minHeight = 100;
    const maxHeight = 400;

    if (newHeight < minHeight) newHeight = minHeight;
    if (newHeight > maxHeight) newHeight = maxHeight;

    inputBox.style.height = newHeight + 'px';
});

document.addEventListener('mouseup', function () {
    isResizing = false;
});

function sendMessage() {
    const text = inputBox.value.trim();
    if (!text) return;
    inputBox.value = '';
    inputBox.style.height = '100px';
}