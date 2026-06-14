Kali Agent

Kali Agent is a Chrome Extension AI assistant that provides a chat interface within Chrome’s side panel. It integrates with Google Gemini to generate responses and uses a local Python (Flask) backend to handle requests and manage the conversation flow.

---

Overview

The extension allows users to interact with an AI assistant directly inside the browser without switching tabs. It supports multi-turn conversations, model selection, and message-level actions such as retrying and editing inputs.

---

Features

* Chrome Extension built with Manifest V3
* Side panel chat interface
* Integration with Google Gemini models
* Multi-turn conversation support
* Model selection for different Gemini variants
* Message actions include retry, copy, edit, and feedback.
* Attach PDFs, DOCX, PPTX, and common image files from the composer
* Local Flask backend with CORS support

---

Project Structure

.
├── background.js
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── server.py
├── requirements.txt
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
└── README.md

---

Requirements

* Google Chrome or any Chromium-based browser
* Python 3.10 or higher
* A valid Google Gemini API key

---

Installation and Setup

1. Clone the Repository

git clone <your-repo-url>
cd Kali-Agent

2. Configure Environment Variables

Create a .env file in the root directory and add your API key:

GEMINI_API_KEY=your_api_key_here

You can obtain an API key from:
https://aistudio.google.com/app/apikey

---

3. Install Dependencies

pip install -r requirements.txt

---

4. Start the Backend Server

python server.py

The server will run at:

http://localhost:5000

---

5. Load the Extension in Chrome

1. Open chrome://extensions/
2. Enable Developer Mode
3. Click “Load unpacked.”
4. Select the project folder.

---

Usage

* Open the extension side panel.
* Enter a message and submit it.
* Use the plus button to attach up to 5 files per message.
* Optionally select a Gemini model.
* Use message actions to retry, edit, copy, or provide feedback.

---

API Endpoints

POST /chat

Sends a message to the AI model.

Request:

{
  "message": "Hello",
  "model": "gemini-2.5-flash"
}

Multipart form-data is also supported for attachments:

* `message`: optional text prompt
* `model`: selected model name
* `attachments`: up to 5 files, each up to 10 MB

Supported attachments:

* PDF
* DOCX
* PPTX
* PNG, JPG, JPEG, GIF, WEBP

Response:

{
  "reply": "Hello! How can I assist you?"
}

---

POST /reset

Clears the current conversation history.

---

GET /health

Returns the backend status and active model.

Example response:

{
  "status": "ok",
  "model": "gemini-2.5-flash"
}

---

Permissions

The extension uses the following permissions:

* storage for saving local data
* sidePanel for rendering the chat interface

---

Notes

* The backend server must be running for the extension to function correctly.
* Conversation history is stored in memory and resets when the server restarts.
* If the backend is unavailable, the extension will not return responses.

---

Troubleshooting

Backend does not start.

* Ensure the .env file exists.
* Verify that the API key is correct.
* Confirm all dependencies are installed.

No response in the extension

* Check that the backend server is running.
* Verify it is accessible at http://localhost:5000.
* Reload the extension

Changes not reflected

* Reload the extension from chrome://extensions/
* Remove and re-add the unpacked extension if necessary.

---

License

MIT License

Copyright (c) 2026 Nouman Khan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including, without limitation, the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
