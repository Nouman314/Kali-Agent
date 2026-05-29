chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

const inputBox = document.querySelector('.input-box');

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

function sendMessage() {
    const text = inputBox.value.trim();
    if (!text) return;
    inputBox.value = '';
    inputBox.style.height = 'auto';
}