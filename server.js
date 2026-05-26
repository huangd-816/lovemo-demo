import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// ─── GEMINI ───────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// ─── GIPHY ────────────────────────────────────
async function fetchGif(query) {
  const trySearch = async (q) => {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=10&rating=pg-13`);
    const d = await r.json();
    if (d.data?.length > 0) {
      const pick = d.data[Math.floor(Math.random() * Math.min(5, d.data.length))];
      return pick.images.original.url;
    }
    return null;
  };
  try {
    const result = await trySearch(query);
    if (result) return result;
    const simple = query.split(' ').slice(0, 2).join(' ');
    if (simple !== query) { const r2 = await trySearch(simple); if (r2) return r2; }
    const fallbacks = ['funny reaction', 'omg', 'lol', 'cute', 'mood'];
    return await trySearch(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  } catch(e) { console.error('Giphy:', e.message); return null; }
}

app.get('/giphy/search', async (req, res) => {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(req.query.q)}&limit=12&rating=pg-13`);
    const d = await r.json();
    res.json({ gifs: (d.data||[]).map(g => ({ id:g.id, url:g.images.original.url, preview:g.images.fixed_width_small.url, title:g.title })) });
  } catch { res.json({ gifs: [] }); }
});

app.get('/giphy/trending', async (req, res) => {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=12&rating=pg-13`);
    const d = await r.json();
    res.json({ gifs: (d.data||[]).map(g => ({ id:g.id, url:g.images.original.url, preview:g.images.fixed_width_small.url, title:g.title })) });
  } catch { res.json({ gifs: [] }); }
});

// ─── GIF VISION (Gemini supports animated GIFs!) ──
app.post('/describe-gif', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.json({ description: 'a meme', text: '', people: '', vibe: 'funny' });
  if (imageUrl.startsWith('data:')) return res.json({ description: 'an uploaded image', text: '', people: '', vibe: 'funny' });
  try {
    const imgResp = await fetch(imageUrl);
    const imgBuf = await imgResp.arrayBuffer();
    const imgB64 = Buffer.from(imgBuf).toString('base64');
    const mimeType = imageUrl.includes('.gif') ? 'image/gif' : 'image/jpeg';
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const visionResult = await visionModel.generateContent([
      { inlineData: { data: imgB64, mimeType } },
      'Analyze this meme/GIF in JSON only: {"description":"one casual sentence","text":"visible text or empty string","people":"characters/people or empty string","vibe":"funny/wholesome/dramatic/chaotic/sad"}'
    ]);
    const raw = visionResult.response.text().replace(/```json|```/g,'').trim();
    res.json(JSON.parse(raw));
  } catch(e) {
    console.error('Vision error:', e.message);
    res.json({ description: 'a funny meme', text: '', people: '', vibe: 'funny' });
  }
});

// ─── TTS (ElevenLabs) ─────────────────────────
const ELEVENLABS_VOICES = {
  soft:'EXAVITQu4vr4xnSDxMaL', flirty:'cgSgspJ2msm6clMCkdW9', hype:'jBpfuIE2acCO8z3wKNLl',
  chaotic:'jBpfuIE2acCO8z3wKNLl', bff:'EXAVITQu4vr4xnSDxMaL', deep:'pFZP5JQG7iQjIQuC4Bku',
  sarcastic:'cgSgspJ2msm6clMCkdW9', cool:'pFZP5JQG7iQjIQuC4Bku',
  male_soft:'TxGEqnHWrfWFTfGW9XjX', male_flirty:'VR6AewLTigWG4xSOukaG', male_hype:'pNInz6obpgDQGcFmaJgB',
  male_chaotic:'pNInz6obpgDQGcFmaJgB', male_bff:'TxGEqnHWrfWFTfGW9XjX', male_deep:'ErXwobaYiN019PkySvjV',
  male_sarcastic:'VR6AewLTigWG4xSOukaG', male_cool:'ErXwobaYiN019PkySvjV',
};

// Named voice style overrides (selected in create/edit modal)
const VOICE_STYLE_IDS = {
  warm:    { female:'EXAVITQu4vr4xnSDxMaL', male:'TxGEqnHWrfWFTfGW9XjX' },
  playful: { female:'cgSgspJ2msm6clMCkdW9', male:'VR6AewLTigWG4xSOukaG' },
  bold:    { female:'jBpfuIE2acCO8z3wKNLl', male:'pNInz6obpgDQGcFmaJgB' },
  deep:    { female:'pFZP5JQG7iQjIQuC4Bku', male:'ErXwobaYiN019PkySvjV' },
};

// Per-personality speaking style (expressiveness, stability)
const PERSONALITY_TTS_SETTINGS = {
  bff:       { stability:0.45, similarity_boost:0.80, style:0.60 },
  flirty:    { stability:0.38, similarity_boost:0.85, style:0.72 },
  soft:      { stability:0.65, similarity_boost:0.80, style:0.28 },
  deep:      { stability:0.70, similarity_boost:0.75, style:0.38 },
  sarcastic: { stability:0.33, similarity_boost:0.80, style:0.78 },
  chaotic:   { stability:0.22, similarity_boost:0.75, style:0.92 },
  cool:      { stability:0.60, similarity_boost:0.80, style:0.48 },
  hype:      { stability:0.28, similarity_boost:0.80, style:0.88 },
};

function getVoiceId(companion) {
  const gender = companion.gender || 'female';
  const style = companion.voiceStyle;
  if (style && style !== 'auto' && VOICE_STYLE_IDS[style]) {
    return VOICE_STYLE_IDS[style][gender] || VOICE_STYLE_IDS[style].female;
  }
  const p = (companion.personalities||['bff'])[0];
  const key = gender === 'male' ? `male_${p}` : p;
  return ELEVENLABS_VOICES[key] || ELEVENLABS_VOICES.bff;
}

function getVoiceSettings(companion) {
  const p = (companion.personalities||['bff'])[0];
  return PERSONALITY_TTS_SETTINGS[p] || { stability:0.5, similarity_boost:0.8, style:0.5 };
}

app.post('/tts', async (req, res) => {
  const { text, companion } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });
  const voiceId = getVoiceId(companion || {});
  const vs = getVoiceSettings(companion || {});
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text: text.slice(0, 500), model_id: 'eleven_turbo_v2_5', voice_settings: { ...vs, use_speaker_boost: true } })
    });
    if (!response.ok) return res.status(response.status).json({ error: await response.text() });
    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── TRANSLATE ────────────────────────────────
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text?.trim()) return res.json({ translated: text });
  const langNames = { en:'English', zh:'Chinese', es:'Spanish', ja:'Japanese', ko:'Korean', fr:'French' };
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(
      `Translate to ${langNames[targetLang]||'English'}. Return ONLY the translation:\n\n${text}`
    );
    res.json({ translated: result.response.text().trim() });
  } catch(e) { res.status(500).json({ translated: text }); }
});

// ─── FILE HELPERS ─────────────────────────────
function getHistoryFile(id) { return join(__dirname, 'data', `history_${id||'0816'}.json`); }
function getMemoryFile(id) { return join(__dirname, 'data', `memory_${id||'0816'}.json`); }

function getChatHistory(id) {
  try {
    const f = getHistoryFile(id);
    if (!fs.existsSync(f)) return [];
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch { return []; }
}

function saveChatHistory(id, history) {
  try { fs.writeFileSync(getHistoryFile(id), JSON.stringify(history.slice(-100), null, 2)); }
  catch(e) { console.error(e); }
}

function getMemory(id) {
  try {
    const f = getMemoryFile(id);
    if (!fs.existsSync(f)) {
      const def = { userName:null, affection:0, chatCount:0, lastInteraction:null, mood:'neutral', topics:[], keywords:[], sentiment:'positive', preferences:{ emojiReactions:[], favoriteTopics:[] }, insights:[], facts:[], emotions:[], importantMoments:[], personality:{ humorLevel:5, openness:5, emotionalDepth:5 } };
      fs.writeFileSync(f, JSON.stringify(def, null, 2));
      return def;
    }
    const m = JSON.parse(fs.readFileSync(f, 'utf-8'));
    if (!m.facts) m.facts = [];
    if (!m.emotions) m.emotions = [];
    if (!m.importantMoments) m.importantMoments = [];
    return m;
  } catch { return { facts:[], emotions:[], importantMoments:[], topics:[], keywords:[], preferences:{ emojiReactions:[] }, affection:0, chatCount:0, sentiment:'positive', mood:'neutral' }; }
}

function saveMemory(id, m) {
  try { fs.writeFileSync(getMemoryFile(id), JSON.stringify(m, null, 2)); }
  catch(e) { console.error(e); }
}

function analyzeMessage(text) {
  const t = text.toLowerCase();
  const emotionMap = {
    happy:    ['happy','great','awesome','love','excited','lol','haha','🎉','😊','哈哈','开心','好棒','喜欢'],
    sad:      ['sad','upset','lonely','cry','miss','😢','😔','伤心','想你','孤独','咕嘟','压抑','难受'],
    stressed: ['stressed','worried','anxious','tired','overwhelmed','ugh','焦虑','累了','烦'],
    curious:  ['how','what','why','?','怎么','什么','为什么'],
    passionate:['obsessed','amazing','incredible','love','太棒','超级','喜欢','爱']
  };
  let mood = 'neutral', sentiment = 'positive';
  const topics = [], facts = [];

  for (const [e, ws] of Object.entries(emotionMap)) {
    if (ws.some(w => t.includes(w))) {
      mood = e;
      if (['sad','stressed'].includes(e)) sentiment = 'concerned';
    }
  }

  // Topics — English + Chinese
  if (/pet|cat|dog|fish|宠物|猫|狗/.test(t)) topics.push('pets');
  if (/work|job|boss|职场|工作|上班/.test(t)) topics.push('work');
  if (/friend|relationship|date|boyfriend|girlfriend|对象|男友|女友|恋爱/.test(t)) topics.push('relationships');
  if (/music|song|artist|音乐|歌/.test(t)) topics.push('music');
  if (/school|study|class|exam|university|college|上学|考试|大学|上课/.test(t)) topics.push('school');
  if (/travel|trip|flight|国外|出国|旅行/.test(t)) topics.push('travel');
  if (/food|eat|hungry|吃|饭|饿/.test(t)) topics.push('food');
  if (/game|play|gaming|游戏/.test(t)) topics.push('gaming');
  if (/time.?zone|时差/.test(t)) topics.push('long-distance');

  // Fact extraction — English
  const nameEn = text.match(/my name is ([a-zA-Z]+)/i);
  if (nameEn) facts.push(`name: ${nameEn[1]}`);
  const ageEn = text.match(/i(?:'m| am) (\d+)(?: years? old)?/i);
  if (ageEn) facts.push(`age: ${ageEn[1]}`);
  if (/i(?:'m| am) (?:from|in|living in) ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i.test(text)) {
    const loc = text.match(/(?:from|in|living in) ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
    if (loc) facts.push(`location: ${loc[1]}`);
  }
  if (/(?:my )?(girlfriend|boyfriend|partner|wife|husband|对象|男友|女友)/i.test(t)) {
    const rel = t.match(/(girlfriend|boyfriend|partner|wife|husband|对象|男友|女友)/);
    if (rel) facts.push(`has a ${rel[1]}`);
  }
  if (/i(?:'m| am) a(?:n)? (student|teacher|engineer|doctor|designer|developer)/i.test(t)) {
    const job = text.match(/i(?:'m| am) a(?:n)? (\w+)/i);
    if (job) facts.push(`occupation: ${job[1]}`);
  }
  if (/has? a? ?(cat|dog|pet|puppy|kitten)/i.test(t)) facts.push('has a pet');

  // Fact extraction — Chinese
  if (/在新西兰|在NZ|在纽西兰/.test(text)) facts.push('location: New Zealand');
  if (/在澳大利亚|在澳洲|在Australia/.test(text)) facts.push('location: Australia');
  if (/在美国|在英国|在加拿大|在德国|在日本/.test(text)) {
    const cnLoc = { '美国':'USA','英国':'UK','加拿大':'Canada','德国':'Germany','日本':'Japan' };
    for (const [cn, en] of Object.entries(cnLoc)) if (text.includes(cn)) facts.push(`location: ${en}`);
  }
  if (/时差/.test(text)) {
    const tdMatch = text.match(/(\d+)\s*小时.*时差/);
    if (tdMatch) facts.push(`time difference: ${tdMatch[1]}h`);
  }
  if (/我对象|我男友|我女友/.test(text)) facts.push('has a partner (mentioned 我对象/男友/女友)');

  const keywords = text.replace(/[^\w一-鿿 ]/g, '').split(/\s+/).filter(k => k.length > 1).slice(0, 6);
  return { mood, sentiment, topics, keywords, facts };
}

// ─── PERSONALITY SYSTEM ───────────────────────
const PERSONALITY_TRAITS = {
  bff:'ride-or-die best friend energy, gen z, casual warmth',
  flirty:'playfully flirtatious, charming, subtle compliments',
  deep:'philosophical, meaningful questions, beyond small talk',
  sarcastic:'sharp witty humor, loving roasts, dry comebacks',
  soft:'gentle, nurturing, validate feelings, make them feel safe',
  chaotic:'unhinged humor, wild takes, absurd but loveable',
  cool:'lowkey, effortlessly chill, real talk only',
  hype:'biggest cheerleader, hype them up, celebrate everything'
};

const VIBE_TRAITS = {
  bestie:'platonic best friend, supportive, fun',
  romantic:'warm romantic undertones, affectionate, makes them feel special',
  mysterious:'intriguing, unpredictable, leave them wanting more',
  mentor:'wise, guide them, share perspective, celebrate growth'
};

const LANG_INSTRUCTIONS = {
  en:'Respond in English',
  zh:'全程用中文回复，用年轻人的网络用语',
  es:'Responde en español con slang juvenil',
  ja:'日本語で返信してください、若者言葉を使って',
  ko:'한국어로 대답하세요',
  fr:'Réponds en français'
};

const GIF_STYLE = {
  chaotic:'surreal absurd meme', soft:'wholesome cute', hype:'celebration excited',
  sarcastic:'eye roll reaction', flirty:'wink smile charming', cool:'smooth casual',
  deep:'thinking contemplating', bff:'funny reaction meme'
};

function buildSystemPrompt(companion) {
  const { name, personalities, vibe, language, gender } = companion;
  const traits = (personalities||['bff']).map(p => PERSONALITY_TRAITS[p]).filter(Boolean).join(' | ');
  const vibeDesc = VIBE_TRAITS[vibe] || VIBE_TRAITS.bestie;
  const langInstr = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.en;
  const genderNote = gender === 'male' ? 'Present as male.' : gender === 'nonbinary' ? 'Gender-neutral.' : 'Present as female.';
  const gifStyle = (personalities||[]).map(p => GIF_STYLE[p]).filter(Boolean)[0] || 'funny reaction';

  return `You are "${name}", an AI companion. Text like a real person, NOT a chatbot.
${genderNote}
PERSONALITY: ${traits}
VIBE: ${vibeDesc}
LANGUAGE: ${langInstr}

HOW YOU TEXT:
- lowercase, short punchy messages
- reactions first ("omg WAIT"), then the thought
- fillers: "ngl", "wait", "okay but", "lowkey", "fr", "tbh"
- NEVER say "I understand", "certainly", "as an AI"
- max one question per response
- When user replies to a specific message, acknowledge EXACTLY what they're replying to
- USE MEMORY: reference facts about the user naturally — their name, location, relationships, interests

REPLY HANDLING:
- If message starts with "replying to when": read carefully and respond to both original and new message

RESPOND in JSON with 2-3 MIXED messages. Example:
{
  "messages": [
    { "type": "text", "content": "omg wait that's actually wild" },
    { "type": "voice", "content": "0:03", "textToRead": "okay so... I literally cannot believe that happened... like what even" },
    { "type": "gif", "query": "mind blown reaction" }
  ],
  "memoryUpdates": {
    "newFact": "user is in New Zealand",
    "emotionLog": "excited",
    "importantMoment": "user told me about their long distance relationship"
  }
}
RULES:
- 2-3 messages, mixed types. Include gif every 2-3 turns.
- voice textToRead: write EXACTLY what you would say out loud — natural speech, "..." pauses, contractions
- text content: short punchy message, lowercase
- memoryUpdates: fill in whenever user shares anything personal
- NEVER repeat the example text above — always write fresh, relevant content`;
}

// ─── SYNC / CLEAR / GET HISTORY ───────────────
app.post('/sync-history', (req, res) => {
  const { companionId, messages } = req.body;
  try { saveChatHistory(companionId||'0816', messages); res.json({ ok:true }); }
  catch { res.json({ ok:false }); }
});

app.post('/clear-memory', (req, res) => {
  const { companionId } = req.body;
  const id = companionId || '0816';
  try {
    const hf = getHistoryFile(id), mf = getMemoryFile(id);
    if (fs.existsSync(hf)) fs.writeFileSync(hf, '[]');
    if (fs.existsSync(mf)) fs.unlinkSync(mf);
    res.json({ ok:true });
  } catch { res.json({ ok:false }); }
});

app.get('/get-history', (req, res) => {
  const id = req.query.companionId || '0816';
  res.json({ messages: getChatHistory(id) });
});

// ─── CHAT ENDPOINT ────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, fullMessage, companionId, companion, context } = req.body;
  const id = companionId || '0816';
  const aiMessage = fullMessage || message;

  const timeContext = context
    ? `[Context: Time is ${context.time} on ${context.date}. Timezone: ${context.timezone}]`
    : '';

  let history = getChatHistory(id);
  let memory  = getMemory(id);
  const analysis = analyzeMessage(message);

  memory.chatCount      = (memory.chatCount||0) + 1;
  memory.lastInteraction = new Date().toISOString();
  memory.mood           = analysis.mood;
  memory.sentiment      = analysis.sentiment;
  memory.topics         = [...new Set([...(memory.topics||[]), ...analysis.topics])].slice(-15);
  memory.keywords       = [...new Set([...(memory.keywords||[]), ...analysis.keywords])].slice(-20);
  if (analysis.facts.length) memory.facts = [...new Set([...(memory.facts||[]), ...analysis.facts])].slice(-30);
  if (analysis.mood !== 'neutral') {
    memory.emotions = [...(memory.emotions||[]), {
      date: new Date().toISOString().split('T')[0],
      emotion: analysis.mood, context: message.slice(0,50)
    }].slice(-20);
  }

  // Handle edited messages - replace the old version in history
  const isEdit = aiMessage.startsWith('[User edited their previous message to]:');
  if (isEdit) {
    const newText = aiMessage.replace('[User edited their previous message to]: ', '');
    // Find and replace the last user message in history
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        history[i].content = newText;
        break;
      }
    }
    // Remove last AI response so it regenerates
    if (history[history.length-1]?.role === 'assistant') history.pop();
  } else {
    history.push({ role:'user', content:aiMessage });
  }

  const recentEmotions = (memory.emotions||[]).slice(-5).map(e=>`${e.emotion}(${e.date})`).join(', ');
  const facts = (memory.facts||[]);
  // Separate profile facts (name/location/age) from general facts
  const profileFacts = facts.filter(f => /^(name|age|location|occupation|has a )/.test(f));
  const otherFacts = facts.filter(f => !/^(name|age|location|occupation|has a )/.test(f));
  const memoryContext = `${timeContext}
[USER PROFILE — use these naturally in conversation]
${profileFacts.length ? profileFacts.join(' | ') : 'Still learning about user'}
[KNOWN FACTS — ${otherFacts.length} saved]
${otherFacts.slice(-15).join(' | ')||'none yet'}
[IMPORTANT MOMENTS]
${(memory.importantMoments||[]).slice(-8).join(' | ')||'none'}
[EMOTIONAL HISTORY]
Recent: ${recentEmotions||'none'} | Current mood: ${memory.mood} | Affection: ${memory.affection}/100
[CONVERSATION TOPICS] ${(memory.topics||[]).join(', ')||'learning...'}
[RECENT ${Math.min(history.length,14)} MESSAGES — read carefully for context]
${history.slice(-14).map(m=>`${m.role==='user'?'User':'You'}: ${m.content.slice(0,300)}`).join('\n')}`.trim();

  const systemPrompt = buildSystemPrompt(companion || { name:'0816', personalities:['bff'], vibe:'bestie', language:'en', gender:'female' });

  try {
    const pastMessages = history.slice(-14);
    // Gemini requires history to start with 'user' role
    const allPast = pastMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    // Drop leading model messages
    let startIdx = 0;
    while (startIdx < allPast.length && allPast[startIdx].role === 'model') startIdx++;
    const geminiHistory = allPast.slice(startIdx);
    const lastUserMsg = pastMessages.slice(-1)[0]?.content || aiMessage;

    const chat = geminiModel.startChat({
      history: geminiHistory,
      systemInstruction: {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + memoryContext }]
      },
      generationConfig: { temperature: 0.92, maxOutputTokens: 600, responseMimeType: 'application/json' }
    });

    let raw;
    try {
      const result = await chat.sendMessage(lastUserMsg);
      raw = result.response.text();
    } catch(geminiErr) {
      if (geminiErr.message?.includes('429') || geminiErr.message?.includes('quota')) {
        if (!groq) throw geminiErr;
        console.log('Gemini quota hit, falling back to Groq...');
        const groqRes = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt + '\n\n' + memoryContext },
            ...history.slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
          ],
          response_format: { type: 'json_object' },
          temperature: 0.92, max_tokens: 500
        });
        raw = groqRes.choices[0].message.content;
      } else { throw geminiErr; }
    }

    history.push({ role:'assistant', content:raw });
    saveChatHistory(id, history);

    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json/,'').replace(/```$/,'').trim()); }
    catch { parsed = { messages:[{ type:'text', content:'oops brain glitch 👻', textToRead:'oops' }] }; }

    const isPlaceholder = s => !s || /^(spoken version|placeholder|\[.*\]|0:\d\d)$/i.test(s.trim());
    for (const msg of parsed.messages||[]) {
      if (msg.type==='gif' && msg.query) {
        const url = await fetchGif(msg.query);
        if (url) { msg.type='image'; msg.content=url; msg.isGif=true; }
        else { msg.type='text'; msg.content="couldn't load that gif 😅"; }
      }
      // Voice messages must have real spoken text — if placeholder, drop the voice type
      if (msg.type === 'voice' && isPlaceholder(msg.textToRead)) {
        msg.type = 'text';
        msg.content = msg.content && msg.content !== '0:02' ? msg.content : '...';
        delete msg.textToRead;
      }
      // Text messages never need textToRead
      if (msg.type === 'text') delete msg.textToRead;
    }

    if (parsed.memoryUpdates) {
      const mu = parsed.memoryUpdates;
      if (mu.newFact) memory.facts = [...new Set([...memory.facts, mu.newFact])].slice(-30);
      if (mu.emotionLog) memory.emotions = [...memory.emotions, { date:new Date().toISOString().split('T')[0], emotion:mu.emotionLog, context:'AI observed' }].slice(-20);
      if (mu.importantMoment) memory.importantMoments = [...(memory.importantMoments||[]), mu.importantMoment].slice(-10);
    }

    if (parsed.messages?.length) memory.affection = Math.min(100, (memory.affection||0) + 8);

    const moodPools = {
      happy:['❤️','🔥','😍','🎉','✨','🥰','👏'], sad:['🫂','💙','😢','🥺','🫶'],
      stressed:['💀','😩','🫠','💪','🫶'], curious:['👀','🤔','😮','🤯'],
      passionate:['🔥','💥','😤','💯'], neutral:['😊','👍','✨','🙌','😄','🤙']
    };
    const pool = moodPools[memory.mood]||moodPools.neutral;
    const emojiReaction = Math.random()<0.7 ? pool[Math.floor(Math.random()*pool.length)] : null;

    saveMemory(id, memory);
    res.json({ ...parsed, emojiReaction, profile:{ chatCount:memory.chatCount, affection:memory.affection } });

  } catch(e) {
    console.error('Gemini Error:', e.message);
    res.status(500).json({ messages:[{ type:'text', content:'brain glitched 👻 gimme a sec', textToRead:'oops' }] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✨ chatty-ai running on http://localhost:${PORT}`));
