"""
server.py - Kali Agent Backend
================================
A lightweight Flask server that bridges the Chrome Extension UI
with the Google Gemini API.

Usage:
    1. Fill in your GEMINI_API_KEY in the .env file
    2. pip install -r requirements.txt
    3. python server.py
    4. Server runs at http://localhost:5000

Endpoint:
    POST /chat
    Body:    { "message": "your question here" }
    Returns: { "reply": "AI response here" }
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai

# -- Load environment variables from .env --------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
    raise RuntimeError(
        "\n\n[ERROR] Gemini API key not found!\n"
        "    Open the .env file and replace 'your_gemini_api_key_here'\n"
        "    with your real key from https://aistudio.google.com/app/apikey\n"
    )

# -- Configure Gemini (new google.genai SDK) -----------------------
client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = (
    "You are Kali Agent, a helpful and intelligent AI assistant "
    "built into a Chrome extension. Be concise, accurate, and friendly."
)

# Keep conversation history in memory for context
conversation_history = []

# -- Flask App -----------------------------------------------------
app = Flask(__name__)

# Allow requests from the Chrome extension (chrome-extension://)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/chat", methods=["POST"])
def chat():
    """
    Receives a user message from the Chrome extension,
    sends it to Gemini, and returns the AI reply.
    """
    data = request.get_json(silent=True)

    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' field in request body."}), 400

    user_message = data["message"].strip()
    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    try:
        # Build contents with history for multi-turn conversation
        contents = []
        for entry in conversation_history:
            contents.append(genai.types.Content(
                role=entry["role"],
                parts=[genai.types.Part(text=entry["text"])]
            ))
        contents.append(genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=user_message)]
        ))

        selected_model = data.get("model", MODEL_NAME)
        response = client.models.generate_content(
            model=selected_model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
            ),
        )

        reply = response.text

        # Save to history
        conversation_history.append({"role": "user", "text": user_message})
        conversation_history.append({"role": "model", "text": reply})

        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[ERROR] Gemini API call failed: {e}")
        return jsonify({"error": f"AI error: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health():
    """Simple health check endpoint."""
    return jsonify({"status": "ok", "model": MODEL_NAME})


@app.route("/reset", methods=["POST"])
def reset():
    """Clears conversation history for a fresh start."""
    conversation_history.clear()
    return jsonify({"status": "ok", "message": "Conversation history cleared."})


# -- Entry Point ----------------------------------------------------
if __name__ == "__main__":
    print("")
    print("[OK] Kali Agent backend is running!")
    print("     Listening at: http://localhost:5000")
    print("     Press Ctrl+C to stop.")
    print("")
    app.run(host="localhost", port=5000, debug=False)
