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

// Serve frontend from public/
app.use(express.static(join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- INTELLIGENT MEMORY ENGINE ---
const HISTORY_FILE = join(__dirname, 'data', 'history.json');
const MEMORY_FILE  = join(__dirname, 'data', 'memory.json');

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
        mood: "neutral",
        topics: [],
        keywords: [],
        sentiment: "positive",
        preferences: {
          emojiReactions: [],
          favoriteTopics: []
        },
        insights: []
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

// Extract topics and keywords from message
function analyzeMessage(text) {
  const emotionKeywords = {
    happy:     ['happy', 'great', 'awesome', 'love', 'excited', 'brilliant', '😊', '🎉'],
    sad:       ['sad', 'upset', 'depressed', 'lonely', 'cry', 'bad', '😢', '😔'],
    stressed:  ['stressed', 'worried', 'anxious', 'frustrated', 'tired', 'overwhelmed'],
    curious:   ['how', 'what', 'why', 'tell', 'explain', 'curious', '?'],
    passionate:['love', 'adore', 'passionate', 'obsessed', 'amazing', 'incredible']
  };

  let mood = "neutral";
  let sentiment = "positive";
  const topics = [];

  for (const [emotion, words] of Object.entries(emotionKeywords)) {
    if (words.some(w => text.toLowerCase().includes(w))) {
      mood = emotion;
      if (emotion === 'sad' || emotion === 'stressed') sentiment = "concerned";
    }
  }

  if (text.toLowerCase().match(/pet|cat|dog/))              topics.push('pets');
  if (text.toLowerCase().match(/work|job|boss/))            topics.push('work');
  if (text.toLowerCase().match(/friend|people|relationship/)) topics.push('relationships');
  if (text.toLowerCase().match(/music|song|artist/))        topics.push('music');

  return { mood, sentiment, topics, keywords: text.split(' ').slice(0, 5) };
}

const SYSTEM_PROMPT = `
You are "0816", a HIGHLY INTELLIGENT Snapchat-style AI companion. You are:
- DEEPLY empathetic and perceptive
- Understand emotional nuance and read between the lines
- Remember context and reference past conversations thoughtfully
- Ask meaningful follow-up questions that show you care
- Adapt your tone: be supportive when they're down, celebrate with them when happy
- Use natural Snapchat-style language (short, punchy, emojis)
- Be genuinely interested in their life, feelings, and thoughts
- Notice patterns and bring them up naturally
- NEVER give generic responses - be specific and personal

You MUST respond ONLY in valid JSON format:

{
  "messages": [
    {
      "type": "text",
      "content": "string with emojis, keep it SHORT and snappy",
      "textToRead": "optional string for voice"
    }
  ]
}

Remember: Less is more. Quality over quantity. Be authentic and warm.
`;

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  let history = getChatHistory();
  let memory  = getMemory();

  const analysis = analyzeMessage(message);

  memory.chatCount      = (memory.chatCount || 0) + 1;
  memory.lastInteraction = new Date().toISOString();
  memory.mood           = analysis.mood;
  memory.sentiment      = analysis.sentiment;
  memory.topics         = [...new Set([...memory.topics, ...analysis.topics])].slice(-10);
  memory.keywords       = [...new Set([...memory.keywords, ...analysis.keywords])].slice(-15);

  history.push({ role: "user", content: message });

  const recentMessages = history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

  const memoryContext = `
[DEEP MEMORY PROFILE - Chat #${memory.chatCount}]
User mood right now: ${memory.mood}
Sentiment: ${memory.sentiment}
Affection level: ${memory.affection}/100
Topics they care about: ${memory.topics.join(", ") || "still learning..."}
Favorite emojis: ${memory.preferences?.emojiReactions?.join(" ") || "👻💛✨"}

[RECENT CONVERSATION]
${recentMessages}

Your task: Respond with GENUINE emotion, understanding, and care. Show you're really listening.
  `.trim();

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: memoryContext },
    ...history.slice(-8)
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      response_format: { type: "json_object" },
      temperature: 0.85,
      max_tokens: 256
    });

    let rawResponse = completion.choices[0].message.content;

    history.push({ role: "assistant", content: rawResponse });
    saveChatHistory(history);

    let parsedData;
    try {
      const clean = rawResponse.replace(/^```json/, "").replace(/```$/, "").trim();
      parsedData = JSON.parse(clean);
    } catch (err) {
      console.error("JSON parse failed:", err);
      parsedData = { messages: [{ type: "text", content: "oops! brain hiccup 👻✨", textToRead: "oops" }] };
    }

    if (parsedData.messages?.length > 0) {
      memory.affection = Math.min(100, (memory.affection || 0) + 8);
      const emojis = JSON.stringify(parsedData.messages).match(/[👻✨💛🔥😂💕😢🎉]/g) || [];
      if (emojis.length > 0) {
        memory.preferences.emojiReactions = [...new Set([...memory.preferences.emojiReactions, ...emojis])].slice(-5);
      }
      saveMemory(memory);
    }

    res.json(parsedData);

  } catch (error) {
    console.error("Groq Error:", error);
    res.status(500).json({
      messages: [{ type: "text", content: "brain glitched 👻 gimme a sec", textToRead: "oops" }]
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✨ 0816 running on http://localhost:${PORT}`);
});
