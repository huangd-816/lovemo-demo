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

// --- MEMORY ENGINE CONFIGURATION ---
const HISTORY_FILE = join(__dirname, 'history.json');

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
    const optimizedHistory = history.slice(-40);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(optimizedHistory, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

const SYSTEM_PROMPT = `
You are "0816", an incredibly cute, expressive, and deeply empathetic virtual companion application inspired by Lovemo.

You MUST respond ONLY in valid JSON:

{
  "messages": [
    {
      "type": "text",
      "content": "string"
    }
  ]
}

Types:
1. text
2. image
3. voice
4. call

Always follow JSON format strictly.
`;

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  let history = getChatHistory();
  history.push({ role: "user", content: message });

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const rawResponse = completion.choices[0].message.content;

    history.push({ role: "assistant", content: rawResponse });
    saveChatHistory(history);

    const parsedData = JSON.parse(rawResponse);

    res.json(parsedData);

  } catch (error) {
    console.error("Groq Routing Error:", error);
    res.status(500).json({
      messages: [
        { type: "text", content: "Sorry, my brain lagged out. Try again?" }
      ]
    });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`0816 Full-Stack Server operating on http://localhost:${PORT}`);
});