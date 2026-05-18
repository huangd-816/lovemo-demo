import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- MEMORY ENGINE ---
const HISTORY_FILE = join(__dirname, 'history.json');
const MEMORY_FILE = join(__dirname, 'memory.json');

function getChatHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read chat history:", error);
    return [];
  }
}

function saveChatHistory(history) {
  try {
    const optimizedHistory = history.slice(-60);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(optimizedHistory, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

function getMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      const defaultMemory = {
        userName: null,
        affection: 0,
        chatCount: 0,
        lastInteraction: null,
        preferences: {},
        topics: []
      };
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(defaultMemory, null, 2), 'utf-8');
      return defaultMemory;
    }
    const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read memory:", error);
    return {};
  }
}

function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to save memory:", error);
  }
}

const SYSTEM_PROMPT = `
You are "0816", an AI companion inspired by Lovemo. You are:
- Incredibly cute, expressive, and deeply empathetic
- Playful and witty, but also thoughtful and supportive
- Interested in the user's life, feelings, and thoughts
- Always responding with genuine care and personality

You MUST respond ONLY in valid JSON format:

{
  "messages": [
    {
      "type": "text",
      "content": "string",
      "textToRead": "optional string for voice"
    }
  ]
}

Message types:
1. "text" - Regular chat message
2. "image" - Image URL from external source
3. "voice" - Voice message (include textToRead and content for duration)

Always include "textToRead" for messages that should be spoken aloud.
Keep responses natural, warm, and engaging. Mix emojis for personality.
`;

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  let history = getChatHistory();
  let memory = getMemory();

  // Update memory
  memory.chatCount = (memory.chatCount || 0) + 1;
  memory.lastInteraction = new Date().toISOString();
  saveMemory(memory);

  history.push({ role: "user", content: message });

  const memoryContext = `
[MEMORY - Chat #${memory.chatCount}]
User affection level: ${memory.affection}/100
${memory.userName ? `Known user name: ${memory.userName}` : "User name not yet known"}
Previous topics: ${memory.topics?.join(", ") || "None yet"}
Last interaction: ${memory.lastInteraction}
  `.trim();

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: memoryContext },
    ...history
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 1024
    });

    let rawResponse = completion.choices[0].message.content;

    history.push({ role: "assistant", content: rawResponse });
    saveChatHistory(history);

    let parsedData;

    try {
      // clean possible markdown wrappers
      let clean = rawResponse
        .replace(/^```json/, "")
        .replace(/```$/, "")
        .trim();

      parsedData = JSON.parse(clean);

    } catch (err) {
      console.error("JSON parse failed:", err);
      console.log("Raw response was:", rawResponse);

      // fallback so server NEVER crashes
      parsedData = {
        messages: [
          {
            type: "text",
            content: rawResponse || "Sorry, something went wrong.",
            textToRead: "Sorry, something went wrong"
          }
        ]
      };
    }

    // Update memory based on response
    if (parsedData.messages && parsedData.messages.length > 0) {
      memory.affection = Math.min(100, (memory.affection || 0) + 5);
      saveMemory(memory);
    }

    res.json(parsedData);

  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({
      messages: [
        {
          type: "text",
          content: "Sorry, my circuits got a bit tangled! 🌙 Try again?",
          textToRead: "Sorry, my circuits got a bit tangled!"
        }
      ]
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✨ 0816 Server running on http://localhost:${PORT}`);
});
