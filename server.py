"""
Kali Agent Backend
Bridges the Chrome Extension UI with the Google Gemini API.

Setup:
    1. Add your GEMINI_API_KEY to the .env file
    2. pip install -r requirements.txt
    3. python server.py  →  http://localhost:5000

POST /chat            { "message": "...", "model": "...", "web_search": false }
                      Multipart uploads support up to 5 files by default; Code tab
                      requests set coding_mode=true to allow up to 40 files.
                      →  { "reply": "...", "sources": [...], "images": [...] }
                      Accepts prior conversation turns in the optional "history" array.
                      With Accept: application/x-ndjson, streams search progress and source URLs.
POST /summarize       { "text": "...", "model": "..." }     →  { "reply": "..." }
POST /grammar-fix     { "text": "..." }                      →  { "corrected": "..." }
POST /workspace-chat  multipart: message, model, attachments →  { "reply": "..." }
POST /workspace-reset Clears the Workspace tab's document-chat history
POST /reset           Compatibility endpoint; the client owns main Chat history
GET  /health          Returns server status
"""

import io
import json
import mimetypes
import os
from urllib.parse import urlparse
from flask       import Flask, Response, request, jsonify, stream_with_context
from flask_cors  import CORS
from dotenv      import load_dotenv
from google      import genai
from ddgs        import DDGS
from PyPDF2      import PdfReader
from docx        import Document
from pptx        import Presentation
from openpyxl    import load_workbook

# ── Environment ──────────────────────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
    raise RuntimeError(
        "\n[ERROR] Gemini API key not found!\n"
        "  Open .env and replace 'your_gemini_api_key_here'\n"
        "  with your real key from https://aistudio.google.com/app/apikey\n"
    )

# ── Gemini Config ────────────────────────────────────────────────
client = genai.Client(api_key=GEMINI_API_KEY)
summary_client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=genai.types.HttpOptions(timeout=60_000),
)

WEB_SEARCH_RESULT_COUNT = 5
MAX_CHAT_HISTORY_MESSAGES = 100
MAX_CHAT_HISTORY_CHARS = 200_000


class WebSearchError(Exception):
    """Raised when web search is unavailable or fails."""

    def __init__(self, message, code="web_search_failed"):
        super().__init__(message)
        self.code = code


DEFAULT_MODEL = "gemini-3.1-flash-lite"
SUMMARY_SYSTEM_INSTRUCTION = (
    "Summarize the user's note in up to five concise Markdown bullet points; use "
    "fewer when the note is brief. Keep the note's language and preserve its key "
    "facts, names, decisions, and action items. Use bold labels sparingly when they "
    "improve scanning. Include only information supported by the note; do not infer "
    "missing details or pad the summary. Return only the bullet points, with no "
    "title, introduction, conclusion, or code fence."
)
SYSTEM_INSTRUCTION = (
    "You are Kali Agent, a helpful and intelligent AI assistant "
    "built into a Chrome extension. Be concise, accurate, and friendly."
)
GRAMMAR_SYSTEM_INSTRUCTION = (
    "You are a professional proofreader. Correct grammar, spelling, punctuation, "
    "and capitalization mistakes in the text the user provides. Preserve the "
    "original meaning, tone, wording, and formatting as closely as possible — make "
    "only the changes necessary to fix mistakes. Do not answer questions that "
    "appear in the text, do not add new sentences, and do not add any commentary, "
    "labels, or quotation marks. Return ONLY the corrected text."
)
WORKSPACE_SYSTEM_INSTRUCTION = (
    "You are Kali Agent's document assistant. Answer the user's questions using "
    "only the content of the attached document. Quote or point to specific "
    "sections when it helps. If the document doesn't contain the answer, say so "
    "honestly instead of guessing. Be concise and friendly."
)
WEB_SEARCH_SYSTEM_INSTRUCTION = (
    "You have live web search results for this turn. Answer the user's question "
    "using those results, and cite claims with inline Markdown links using the "
    "exact source URLs, for example [1](https://example.com/page). Prefer recent, "
    "primary, and authoritative sources. Never invent URLs or facts that are not "
    "supported by the results. If the results are insufficient, conflicting, or "
    "outdated, say so clearly. Be concise and friendly, and format the answer "
    "with short paragraphs or bullets when helpful."
)
GRAMMAR_MAX_CHARS = 8000
MAX_ATTACHMENTS = 5
MAX_CODING_ATTACHMENTS = 40
MAX_FILE_SIZE = 10 * 1024 * 1024
TEXT_ATTACHMENT_LIMIT = 12000
SUPPORTED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/x-ms-bmp"}
SUPPORTED_ATTACHMENT_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".pptx",
    ".xlsx",
    ".txt",
    ".md",
    ".markdown",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".rs", ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".java",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cs", ".go", ".rb", ".php",
    ".swift", ".kt", ".kts", ".scala", ".sh", ".bash", ".zsh", ".ps1", ".psm1",
    ".sql", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".json", ".xml",
    ".yaml", ".yml", ".toml", ".ini", ".cfg",
}
CODE_ATTACHMENT_EXTENSIONS = {
    ".rs", ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".java",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cs", ".go", ".rb", ".php",
    ".swift", ".kt", ".kts", ".scala", ".sh", ".bash", ".zsh", ".ps1", ".psm1",
    ".sql", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".json", ".xml",
    ".yaml", ".yml", ".toml", ".ini", ".cfg",
}

# Separate history for the Workspace (document-chat) tab so it never
# bleeds into — or gets cleared by — the main Chat tab's conversation.
workspace_conversation_history = []


def _normalize_extension(filename):
    return os.path.splitext(filename.lower().strip())[1]


def _guess_mime_type(filename, provided_mime_type):
    if provided_mime_type:
        return provided_mime_type
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or ""


def _truncate_text(text, limit=TEXT_ATTACHMENT_LIMIT):
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "\n\n[Truncated]"


def _extract_pdf_text(data):
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            pages.append(page_text.strip())
    return "\n\n".join(pages).strip()


def _extract_docx_text(data):
    document = Document(io.BytesIO(data))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    return "\n\n".join(paragraphs).strip()


def _extract_pptx_text(data):
    presentation = Presentation(io.BytesIO(data))
    slide_text = []
    for slide in presentation.slides:
        pieces = []
        for shape in slide.shapes:
            text = getattr(shape, "text", "").strip()
            if text:
                pieces.append(text)
        if pieces:
            slide_text.append("\n".join(pieces))
    return "\n\n".join(slide_text).strip()


def _extract_xlsx_text(data):
    workbook = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    sheet_text = []
    for sheet in workbook.worksheets:
        rows_text = []
        for row in sheet.iter_rows(values_only=True):
            cells = [str(cell) for cell in row if cell is not None]
            if cells:
                rows_text.append(" | ".join(cells))
        if rows_text:
            sheet_text.append(f"[Sheet: {sheet.title}]\n" + "\n".join(rows_text))
    return "\n\n".join(sheet_text).strip()


def _extract_plain_text(data):
    return data.decode("utf-8", errors="replace").strip()


def _is_supported_attachment(filename, mime_type):
    extension = _normalize_extension(filename)
    if extension not in SUPPORTED_ATTACHMENT_EXTENSIONS:
        return False
    if extension == ".pdf":
        return mime_type == "application/pdf" or extension == ".pdf"
    if extension == ".docx":
        return mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or extension == ".docx"
    if extension == ".pptx":
        return mime_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation" or extension == ".pptx"
    if extension == ".xlsx":
        return mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" or extension == ".xlsx"
    if extension in ({".txt", ".md", ".markdown"} | CODE_ATTACHMENT_EXTENSIONS):
        return True
    return mime_type.startswith("image/") or extension in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


def _build_attachment_context(uploaded_files, user_message, max_attachments=MAX_ATTACHMENTS):
    if len(uploaded_files) > max_attachments:
        return None, None, f"You can attach at most {max_attachments} files."

    prompt_parts = []
    summary_parts = []
    base_prompt = user_message.strip() or "Please analyze the attached files."
    prompt_parts.append(genai.types.Part(text=base_prompt))
    summary_parts.append(base_prompt)

    for uploaded in uploaded_files:
        filename = uploaded.filename or "attachment"
        mime_type = _guess_mime_type(filename, uploaded.mimetype)
        extension = _normalize_extension(filename)
        data = uploaded.read()

        if not data:
            return None, None, f"{filename} is empty."

        if len(data) > MAX_FILE_SIZE:
            return None, None, f"{filename} is larger than 10 MB."

        if not _is_supported_attachment(filename, mime_type):
            return None, None, f"Unsupported file type: {filename}"

        try:
            if extension == ".pdf":
                extracted_text = _truncate_text(_extract_pdf_text(data))
                attachment_text = extracted_text or "[No text extracted from PDF]"
                prompt_parts.append(genai.types.Part(text=f"\n\n[PDF: {filename}]\n{attachment_text}"))
                summary_parts.append(f"[PDF: {filename}]\n{attachment_text}")
            elif extension == ".docx":
                extracted_text = _truncate_text(_extract_docx_text(data))
                attachment_text = extracted_text or "[No text extracted from DOCX]"
                prompt_parts.append(genai.types.Part(text=f"\n\n[DOCX: {filename}]\n{attachment_text}"))
                summary_parts.append(f"[DOCX: {filename}]\n{attachment_text}")
            elif extension == ".pptx":
                extracted_text = _truncate_text(_extract_pptx_text(data))
                attachment_text = extracted_text or "[No text extracted from PPTX]"
                prompt_parts.append(genai.types.Part(text=f"\n\n[PPTX: {filename}]\n{attachment_text}"))
                summary_parts.append(f"[PPTX: {filename}]\n{attachment_text}")
            elif extension == ".xlsx":
                extracted_text = _truncate_text(_extract_xlsx_text(data))
                attachment_text = extracted_text or "[No text extracted from XLSX]"
                prompt_parts.append(genai.types.Part(text=f"\n\n[XLSX: {filename}]\n{attachment_text}"))
                summary_parts.append(f"[XLSX: {filename}]\n{attachment_text}")
            elif extension in ({".txt", ".md", ".markdown"} | CODE_ATTACHMENT_EXTENSIONS):
                extracted_text = _truncate_text(_extract_plain_text(data))
                attachment_text = extracted_text or "[Empty file]"
                label = "CODE" if extension in CODE_ATTACHMENT_EXTENSIONS else ("MD" if extension in {".md", ".markdown"} else "TXT")
                prompt_parts.append(genai.types.Part(text=f"\n\n[{label}: {filename}]\n{attachment_text}"))
                summary_parts.append(f"[{label}: {filename}]\n{attachment_text}")
            else:
                if mime_type not in SUPPORTED_IMAGE_MIME_TYPES:
                    return None, None, f"Unsupported image type: {filename}"

                prompt_parts.append(genai.types.Part.from_bytes(data=data, mime_type=mime_type))
                summary_parts.append(f"[Image attachment: {filename}]")
        except Exception as exc:
            return None, None, f"Could not read {filename}: {exc}"

    return prompt_parts, "\n\n".join(summary_parts).strip(), None


def _as_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_chat_history(history):
    if not isinstance(history, list):
        raise ValueError("Chat history must be a list.")

    normalized = []
    total_chars = 0
    for entry in reversed(history[-MAX_CHAT_HISTORY_MESSAGES:]):
        if not isinstance(entry, dict):
            raise ValueError("Each chat history entry must be an object.")
        role = entry.get("role")
        text = entry.get("text")
        if not isinstance(role, str) or role not in {"user", "model"} or not isinstance(text, str):
            raise ValueError("Chat history entries need a user/model role and text.")
        if total_chars + len(text) > MAX_CHAT_HISTORY_CHARS:
            break
        normalized.append({"role": role, "text": text})
        total_chars += len(text)

    normalized.reverse()
    return normalized


def _web_search(query, count=WEB_SEARCH_RESULT_COUNT):
    """Search the web with DuckDuckGo and return normalized source results."""
    try:
        with DDGS() as ddgs:
            items = ddgs.text(query, max_results=max(1, min(int(count), 10)))
            results = []
            for item in items:
                link = (item.get("href") or "").strip()
                if not link:
                    continue
                results.append({
                    "title": (item.get("title") or link).strip(),
                    "link": link,
                    "snippet": " ".join((item.get("body") or "").split()),
                })
            return results
    except Exception as exc:
        raise WebSearchError(
            f"DuckDuckGo search failed: {exc}",
            code="web_search_failed",
        ) from exc


def _web_image_search(query, count=6):
    """Search DuckDuckGo for HTTPS image thumbnails related to the query."""
    try:
        with DDGS() as ddgs:
            items = ddgs.images(query, max_results=max(1, min(int(count), 10)))
            results = []
            for item in items:
                thumbnail = ""
                for candidate in (item.get("thumbnail"), item.get("image")):
                    candidate = (candidate or "").strip()
                    parsed_candidate = urlparse(candidate)
                    if parsed_candidate.scheme == "https" and parsed_candidate.netloc:
                        thumbnail = candidate
                        break
                if not thumbnail:
                    continue

                page_url = (item.get("url") or "").strip()
                parsed_page_url = urlparse(page_url)
                if parsed_page_url.scheme not in {"http", "https"} or not parsed_page_url.netloc:
                    page_url = thumbnail

                results.append({
                    "title": (item.get("title") or "Image result").strip(),
                    "image": thumbnail,
                    "link": page_url,
                    "source": (item.get("source") or "").strip(),
                })
            return results
    except Exception as exc:
        raise WebSearchError(
            f"DuckDuckGo image search failed: {exc}",
            code="image_search_failed",
        ) from exc


def _format_search_results(query, results):
    if not results:
        return (
            f'[Web search for: "{query}"]\n'
            "No search results were returned. Tell the user that you could not "
            "find live sources and answer cautiously from general knowledge."
        )

    lines = [f'[Web search results for: "{query}"]']
    for index, result in enumerate(results, start=1):
        lines.append(
            f'{index}. {result["title"]}\n'
            f'URL: {result["link"]}\n'
            f'Summary: {result["snippet"] or "(no snippet available)"}'
        )
    return "\n\n".join(lines)


def _ndjson_event(event_type, **payload):
    return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"


def _generate_chat_reply(
    user_message,
    selected_model,
    system_instruction,
    upload_files,
    chat_history,
    use_web_search,
    search_results,
    image_results,
    image_search_error,
    max_attachments=MAX_ATTACHMENTS,
):
    contents = [
        genai.types.Content(role=entry["role"], parts=[genai.types.Part(text=entry["text"])])
        for entry in chat_history
    ]

    attachment_parts, history_message, attachment_error = _build_attachment_context(
        upload_files,
        user_message,
        max_attachments,
    )
    if attachment_error:
        return {"error": attachment_error}, 400

    if use_web_search:
        attachment_parts.insert(
            0,
            genai.types.Part(
                text=_format_search_results(user_message, search_results)
                + "\n\nAnswer the question below using these search results.\n"
            ),
        )

    contents.append(genai.types.Content(
        role="user",
        parts=attachment_parts
    ))

    response = client.models.generate_content(
        model=selected_model,
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
        ),
    )

    return {
        "reply": response.text or "",
        "sources": search_results,
        "images": image_results,
        "image_search_error": image_search_error,
        "history_message": history_message,
    }, 200


def _chat_error_payload(error):
    print(f"[ERROR] Gemini API call failed: {error}")
    error_message = str(error)
    if "image" in error_message.lower() and "does not support" in error_message.lower():
        return {
            "error": "The selected model does not support image input. Please switch to a vision-capable model or remove the image attachment."
        }, 400
    return {"error": f"AI error: {error_message}"}, 500


def _stream_web_search_reply(
    user_message,
    selected_model,
    system_instruction,
    upload_files,
    chat_history,
    max_attachments=MAX_ATTACHMENTS,
):
    yield _ndjson_event("status", text="Searching the web...")
    try:
        search_results = _web_search(user_message)
    except WebSearchError as exc:
        yield _ndjson_event("error", error=str(exc), code=exc.code)
        return

    for source in search_results:
        yield _ndjson_event("source", source={
            "title": source["title"],
            "link": source["link"],
        })

    if search_results:
        image_status = f"Found {len(search_results)} sources. Searching for related images..."
    else:
        image_status = "No sources found. Searching for related images..."
    yield _ndjson_event("status", text=image_status)

    image_results = []
    image_search_error = None
    try:
        image_results = _web_image_search(user_message)
    except WebSearchError as exc:
        image_search_error = str(exc)
        print(f"[WARN] {image_search_error}")

    yield _ndjson_event("status", text="Reviewing the search results and preparing an answer...")
    try:
        payload, status = _generate_chat_reply(
            user_message=user_message,
            selected_model=selected_model,
            system_instruction=f"{system_instruction}\n\n{WEB_SEARCH_SYSTEM_INSTRUCTION}",
            upload_files=upload_files,
            chat_history=chat_history,
            use_web_search=True,
            search_results=search_results,
            image_results=image_results,
            image_search_error=image_search_error,
            max_attachments=max_attachments,
        )
        if status != 200:
            yield _ndjson_event("error", error=payload["error"])
            return
        yield _ndjson_event("result", data=payload)
    except Exception as exc:
        payload, _ = _chat_error_payload(exc)
        yield _ndjson_event("error", error=payload["error"])


# ── Flask App ────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Routes ───────────────────────────────────────────────────────

@app.route("/chat", methods=["POST"])
def chat():
    is_multipart = request.content_type and request.content_type.startswith("multipart/form-data")
    max_attachments = MAX_ATTACHMENTS

    if is_multipart:
        user_message = request.form.get("message", "").strip()
        selected_model = request.form.get("model") or DEFAULT_MODEL
        system_instruction = request.form.get("system_instruction") or SYSTEM_INSTRUCTION
        upload_files = request.files.getlist("attachments")
        if request.form.get("coding_mode") == "true":
            max_attachments = MAX_CODING_ATTACHMENTS
        use_web_search = _as_bool(request.form.get("web_search"))
        try:
            chat_history = json.loads(request.form.get("history", "[]"))
        except json.JSONDecodeError:
            return jsonify({"error": "Chat history must be valid JSON."}), 400
    else:
        data = request.get_json(silent=True) or {}

        if "message" not in data:
            return jsonify({"error": "Missing 'message' field in request body."}), 400

        user_message = data["message"].strip()
        selected_model = data.get("model") or DEFAULT_MODEL
        system_instruction = data.get("system_instruction") or SYSTEM_INSTRUCTION
        use_web_search = _as_bool(data.get("web_search"))
        upload_files = []
        chat_history = data.get("history", [])

    try:
        chat_history = _normalize_chat_history(chat_history)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not user_message and not upload_files:
        return jsonify({"error": "Message cannot be empty."}), 400

    if use_web_search and "application/x-ndjson" in request.headers.get("Accept", ""):
        return Response(
            stream_with_context(_stream_web_search_reply(
                user_message=user_message,
                selected_model=selected_model,
                system_instruction=system_instruction,
                upload_files=upload_files,
                chat_history=chat_history,
                max_attachments=max_attachments,
            )),
            mimetype="application/x-ndjson",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    search_results = []
    image_results = []
    image_search_error = None
    if use_web_search:
        if not user_message:
            return jsonify({"error": "Web search needs a text query."}), 400
        try:
            search_results = _web_search(user_message)
        except WebSearchError as exc:
            return jsonify({"error": str(exc), "code": exc.code}), 400
        try:
            image_results = _web_image_search(user_message)
        except WebSearchError as exc:
            image_search_error = str(exc)
            print(f"[WARN] {image_search_error}")
        system_instruction = f"{system_instruction}\n\n{WEB_SEARCH_SYSTEM_INSTRUCTION}"

    try:
        payload, status = _generate_chat_reply(
            user_message=user_message,
            selected_model=selected_model,
            system_instruction=system_instruction,
            upload_files=upload_files,
            chat_history=chat_history,
            use_web_search=use_web_search,
            search_results=search_results,
            image_results=image_results,
            image_search_error=image_search_error,
            max_attachments=max_attachments,
        )
        return jsonify(payload), status
    except Exception as exc:
        payload, status = _chat_error_payload(exc)
        return jsonify(payload), status


@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected a JSON object."}), 400

    note_text = data.get("text", "")
    if not isinstance(note_text, str):
        return jsonify({"error": "Note content must be text."}), 400
    note_text = note_text.strip()
    selected_model = data.get("model") or DEFAULT_MODEL
    if not isinstance(selected_model, str):
        return jsonify({"error": "Model must be a string."}), 400

    if not note_text:
        return jsonify({"error": "Note content cannot be empty."}), 400

    try:
        response = summary_client.models.generate_content(
            model=selected_model,
            contents=[genai.types.Content(
                role="user",
                parts=[genai.types.Part(text=note_text)],
            )],
            config=genai.types.GenerateContentConfig(
                system_instruction=SUMMARY_SYSTEM_INSTRUCTION,
            ),
        )
        return jsonify({"reply": response.text or ""})
    except Exception as e:
        print(f"[ERROR] Gemini note-summary call failed: {e}")
        return jsonify({"error": f"AI error: {str(e)}"}), 500


@app.route("/grammar-fix", methods=["POST"])
def grammar_fix():
    """
    Stateless, single-turn grammar correction.
    Intentionally does NOT touch the main Chat tab — this is a separate
    feature and shouldn't bleed into chat context.
    """
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Text cannot be empty."}), 400

    if len(text) > GRAMMAR_MAX_CHARS:
        return jsonify({"error": f"Text is too long (max {GRAMMAR_MAX_CHARS} characters)."}), 400

    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=[genai.types.Content(role="user", parts=[genai.types.Part(text=text)])],
            config=genai.types.GenerateContentConfig(
                system_instruction=GRAMMAR_SYSTEM_INSTRUCTION,
            ),
        )

        corrected = (response.text or "").strip()
        return jsonify({"original": text, "corrected": corrected or text})

    except Exception as e:
        print(f"[ERROR] Gemini grammar-fix call failed: {e}")
        return jsonify({"error": f"AI error: {str(e)}"}), 500


@app.route("/workspace-chat", methods=["POST"])
def workspace_chat():
    """
    Document-chat used by the Workspace tab. Keeps its own conversation
    history (workspace_conversation_history), completely separate from the
    client-managed main Chat tab and from grammar-fix, so
    switching between tabs never bleeds context into each other.

    The frontend only attaches the file on the FIRST message of a session —
    after that, the document's text is already part of this endpoint's own
    history, so follow-up questions are sent as plain text.
    """
    is_multipart = request.content_type and request.content_type.startswith("multipart/form-data")
    if not is_multipart:
        return jsonify({"error": "Expected multipart/form-data."}), 400

    user_message = request.form.get("message", "").strip()
    selected_model = request.form.get("model") or DEFAULT_MODEL
    uploaded_files = request.files.getlist("attachments")

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if not uploaded_files and not workspace_conversation_history:
        return jsonify({"error": "No file attached."}), 400

    try:
        contents = [
            genai.types.Content(role=entry["role"], parts=[genai.types.Part(text=entry["text"])])
            for entry in workspace_conversation_history
        ]

        if uploaded_files:
            attachment_parts, history_message, attachment_error = _build_attachment_context(uploaded_files, user_message)
            if attachment_error:
                return jsonify({"error": attachment_error}), 400
            latest_parts = attachment_parts
            latest_history_text = history_message
        else:
            latest_parts = [genai.types.Part(text=user_message)]
            latest_history_text = user_message

        contents.append(genai.types.Content(role="user", parts=latest_parts))

        response = client.models.generate_content(
            model=selected_model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=WORKSPACE_SYSTEM_INSTRUCTION,
            ),
        )

        reply = response.text or ""
        workspace_conversation_history.append({"role": "user", "text": latest_history_text})
        workspace_conversation_history.append({"role": "model", "text": reply})

        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[ERROR] Gemini workspace-chat call failed: {e}")
        error_message = str(e)
        if "image" in error_message.lower() and "does not support" in error_message.lower():
            return jsonify({"error": "The selected model does not support image input. Please switch to a vision-capable model or remove the image attachment."}), 400
        return jsonify({"error": f"AI error: {error_message}"}), 500


@app.route("/workspace-reset", methods=["POST"])
def workspace_reset():
    workspace_conversation_history.clear()
    return jsonify({"status": "ok", "message": "Workspace conversation history cleared."})


@app.route("/reset", methods=["POST"])
def reset():
    return jsonify({"status": "ok", "message": "Main chat history is managed by the client."})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": DEFAULT_MODEL,
        "web_search": {
            "configured": True,
            "provider": "DuckDuckGo",
        },
    })


# ── Entry Point ──────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n[OK] Kali Agent backend is running!")
    print("     Listening at: http://localhost:5000")
    print("     Press Ctrl+C to stop.\n")
    app.run(host="localhost", port=5000, debug=False)
