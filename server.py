"""
Kali Agent Backend
Bridges the Chrome Extension UI with the Google Gemini API.

Setup:
    1. Add your GEMINI_API_KEY to the .env file
    2. pip install -r requirements.txt
    3. python server.py  →  http://localhost:5000

POST /chat   { "message": "...", "model": "..." }  →  { "reply": "..." }
POST /reset  Clears conversation history
GET  /health Returns server status
"""

import os
from flask       import Flask, request, jsonify
from flask_cors  import CORS
from dotenv      import load_dotenv
from google      import genai

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

DEFAULT_MODEL = "gemini-3.1-flash-lite"
SYSTEM_INSTRUCTION = (
    "You are Kali Agent, a helpful and intelligent AI assistant "
    "built into a Chrome extension. Be concise, accurate, and friendly."
)

# Holds multi-turn conversation context in memory
conversation_history = []

# ── Flask App ────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Routes ───────────────────────────────────────────────────────

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)

    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' field in request body."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    try:
        contents = [
            genai.types.Content(role=entry["role"], parts=[genai.types.Part(text=entry["text"])])
            for entry in conversation_history
        ]
        contents.append(genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_message)]
        ))

        selected_model = data.get("model", DEFAULT_MODEL)
        response = client.models.generate_content(
            model=selected_model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
            ),
        )

        reply = response.text
        conversation_history.append({"role": "user",  "text": user_message})
        conversation_history.append({"role": "model", "text": reply})

        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[ERROR] Gemini API call failed: {e}")
        return jsonify({"error": f"AI error: {str(e)}"}), 500


@app.route("/reset", methods=["POST"])
def reset():
    conversation_history.clear()
    return jsonify({"status": "ok", "message": "Conversation history cleared."})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": DEFAULT_MODEL})


# ── Entry Point ──────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n[OK] Kali Agent backend is running!")
    print("     Listening at: http://localhost:5000")
    print("     Press Ctrl+C to stop.\n")
    app.run(host="localhost", port=5000, debug=False)