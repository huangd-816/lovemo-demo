import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ─── GIPHY ────────────────────────────────────
async function fetchGif(query) {
  try {
    const key = process.env.GIPHY_API_KEY;
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=10&rating=pg-13`);
    const d = await r.json();
    if (d.data?.length > 0) {
      const pick = d.data[Math.floor(Math.random() * Math.min(5, d.data.length))];
      return pick.images.original.url;
    }
  } catch(e) { console.error('Giphy:', e.message); }
  return null;
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

// ─── GIF VISION ───────────────────────────────
app.post('/describe-gif', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.json({ description: 'a meme', text: '', people: '', vibe: 'funny' });

  // Skip vision for animated GIFs - model doesn't support them
  if (imageUrl.includes('giphy.com') || imageUrl.endsWith('.gif')) {
    return res.json({ description: 'a funny meme', text: '', people: '', vibe: 'funny' });
  }
  try {
    // Gemini vision - supports animated GIFs!
    const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const imgResp = await fetch(imageUrl);
    const imgBuf = await imgResp.arrayBuffer();
    const imgB64 = Buffer.from(imgBuf).toString('base64');
    const mimeType = imageUrl.includes('.gif') ? 'image/gif' : 'image/jpeg';

    const visionResult = await visionModel.generateContent([
      { inlineData: { data: imgB64, mimeType } },
      `Analyze this meme/GIF and respond in JSON only:
{"description":"one casual sentence","text":"visible text or empty","people":"characters/people or empty","vibe":"funny/wholesome/dramatic/chaotic/sad","context":"meme format if known"}
ONLY JSON, no explanation.`
    ]);
    const result = JSON.parse(visionResult.response.text());
    res.json(result);
  } catch(e) {
    console.error('Vision error:', e.message);
    res.json({ description: 'a funny meme', text: '', people: '', vibe: 'funny', context: '' });
  }
});


// ─── ELEVENLABS TTS ───────────────────────────
// Voice IDs mapped to personality types
const ELEVENLABS_VOICES = {
  // Female voices
  soft:       'EXAVITQu4vr4xnSDxMaL', // Sarah - warm, gentle
  flirty:     'cgSgspJ2msm6clMCkdW9', // Jessica - playful, charming  
  hype:       'jBpfuIE2acCO8z3wKNLl', // Gigi - energetic, bright
  chaotic:    'jBpfuIE2acCO8z3wKNLl', // Gigi - fast and wild
  bff:        'EXAVITQu4vr4xnSDxMaL', // Sarah - friendly default
  deep:       'pFZP5JQG7iQjIQuC4Bku', // Lily - thoughtful, calm
  sarcastic:  'cgSgspJ2msm6clMCkdW9', // Jessica - sharp wit
  cool:       'pFZP5JQG7iQjIQuC4Bku', // Lily - lowkey chill
  // Male voices
  male_soft:      'TxGEqnHWrfWFTfGW9XjX', // Josh - warm
  male_flirty:    'VR6AewLTigWG4xSOukaG', // Arnold - charming
  male_hype:      'pNInz6obpgDQGcFmaJgB', // Adam - energetic
  male_chaotic:   'pNInz6obpgDQGcFmaJgB', // Adam - wild
  male_bff:       'TxGEqnHWrfWFTfGW9XjX', // Josh - friendly
  male_deep:      'ErXwobaYiN019PkySvjV', // Antoni - deep
  male_sarcastic: 'VR6AewLTigWG4xSOukaG', // Arnold - dry wit
  male_cool:      'ErXwobaYiN019PkySvjV', // Antoni - chill
  // Japanese voices (multilingual model handles accent)
  ja_female: 'EXAVITQu4vr4xnSDxMaL',
  ja_male:   'TxGEqnHWrfWFTfGW9XjX',
};

function getVoiceId(companion) {
  const gender = companion.gender || 'female';
  const lang = companion.language || 'en';
  // Japanese - use multilingual voices
  if (lang === 'ja') return gender === 'male' ? ELEVENLABS_VOICES.ja_male : ELEVENLABS_VOICES.ja_female;
  const primaryPersonality = (companion.personalities || ['bff'])[0];
  const key = gender === 'male' ? `male_${primaryPersonality}` : primaryPersonality;
  return ELEVENLABS_VOICES[key] || ELEVENLABS_VOICES.bff;
}

// Voice settings per personality
function getVoiceSettings(personalities = []) {
  const p = personalities[0] || 'bff';
  const settings = {
    chaotic:   { stability: 0.25, similarity_boost: 0.75, style: 0.8, use_speaker_boost: true },
    hype:      { stability: 0.3,  similarity_boost: 0.8,  style: 0.7, use_speaker_boost: true },
    flirty:    { stability: 0.5,  similarity_boost: 0.85, style: 0.5, use_speaker_boost: true },
    soft:      { stability: 0.8,  similarity_boost: 0.9,  style: 0.2, use_speaker_boost: true },
    deep:      { stability: 0.75, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true },
    sarcastic: { stability: 0.45, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
    cool:      { stability: 0.65, similarity_boost: 0.8,  style: 0.35, use_speaker_boost: true },
    bff:       { stability: 0.55, similarity_boost: 0.8,  style: 0.45, use_speaker_boost: true },
  };
  return settings[p] || settings.bff;
}

app.post('/tts', async (req, res) => {
  const { text, companion } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text' });

  const voiceId = getVoiceId(companion || {});
  const settings = getVoiceSettings(companion?.personalities);
  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.slice(0, 500), // cap to save credits
        model_id: (companion?.language === 'ja') ? 'eleven_turbo_v2_5' : 'eleven_turbo_v2_5', // turbo supports multilingual
        voice_settings: settings
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', err);
      return res.status(response.status).json({ error: err });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));

  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
});


// ─── TRANSLATE ────────────────────────────────
app.post('/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text?.trim()) return res.json({ translated: text });

  const langNames = { en:'English', zh:'Chinese', es:'Spanish', ja:'Japanese', ko:'Korean', fr:'French' };
  const targetName = langNames[targetLang] || 'English';

  try {
    // Build Gemini history
    const pastMessages = history.slice(-8);
    const geminiHistory = pastMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const lastUserMsg = pastMessages.slice(-1)[0]?.content || aiMessage;

    const chat = geminiModel.startChat({
      history: geminiHistory,
      systemInstruction: systemPrompt + '\n\n' + memoryContext,
      generationConfig: { temperature: 0.92, maxOutputTokens: 600, responseMimeType: 'application/json' }
    });

    const result = await chat.sendMessage(lastUserMsg);
    const raw = result.response.text();
    history.push({ role:"assistant", content:raw });
    saveChatHistory(id, history);

    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json/,'').replace(/```$/,'').trim()); }
    catch { parsed = { messages:[{ type:"text", content:"oops brain glitch 👻", textToRead:"oops" }] }; }

    // Process GIFs
    for (const msg of parsed.messages||[]) {
      if (msg.type==='gif' && msg.query) {
        const url = await fetchGif(msg.query);
        if (url) { msg.type='image'; msg.content=url; msg.isGif=true; }
        else { msg.type='text'; msg.content="couldn't load that gif 😅"; }
      }
    }

    // Process memory updates
    if (parsed.memoryUpdates) {
      const mu = parsed.memoryUpdates;
      if (mu.newFact) memory.facts = [...new Set([...memory.facts, mu.newFact])].slice(-30);
      if (mu.emotionLog) memory.emotions = [...memory.emotions, { date:new Date().toISOString().split('T')[0], emotion:mu.emotionLog, context:'AI observed' }].slice(-20);
      if (mu.importantMoment) memory.importantMoments = [...(memory.importantMoments||[]), mu.importantMoment].slice(-10);
    }

    if (parsed.messages?.length) {
      memory.affection = Math.min(100, (memory.affection||0) + 8);
      const emojis = JSON.stringify(parsed.messages).match(/[👻✨💛🔥😂💕😢🎉]/g)||[];
      if (emojis.length) memory.preferences.emojiReactions = [...new Set([...memory.preferences.emojiReactions, ...emojis])].slice(-5);
    }

    // Diverse emoji reaction
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
    console.error('Gemini:', e);
    res.status(500).json({ messages:[{ type:"text", content:"brain glitched 👻 gimme a sec", textToRead:"oops" }] });
  }
});

// ─── CHAT ENDPOINT ────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, fullMessage, companionId, companion, context } = req.body;
  const id = companionId || '0816';
  const aiMessage = fullMessage || message;

  const timeContext = context ? `[Current time: ${context.time} on ${context.date}. Timezone: ${context.timezone}. Location: ${context.location}]` : '';

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
  if (analysis.mood !== 'neutral') memory.emotions = [...(memory.emotions||[]), { date:new Date().toISOString().split('T')[0], emotion:analysis.mood, context:message.slice(0,50) }].slice(-20);

  history.push({ role:'user', content:aiMessage });

  const recentEmotions = (memory.emotions||[]).slice(-5).map(e=>`${e.emotion}(${e.date})`).join(', ');
  const memoryContext = `${timeContext}
[DEEP MEMORY - Chat #${memory.chatCount}]
Known facts: ${(memory.facts||[]).join(', ')||'learning...'}
Emotions: ${recentEmotions||'none'}
Important moments: ${(memory.importantMoments||[]).slice(-5).join(' | ')||'none'}
Mood: ${memory.mood} | Affection: ${memory.affection}/100
Topics: ${(memory.topics||[]).join(', ')||'learning...'}

[RECENT - last 8 messages]
${history.slice(-8).map(m=>`${m.role==='user'?'User':'You'}: ${m.content.slice(0,200)}`).join('
')}`.trim();

  const systemPrompt = buildSystemPrompt(companion || { name:'0816', personalities:['bff'], vibe:'bestie', language:'en', gender:'female' });

  try {
    const pastMessages = history.slice(-8);
    const geminiHistory = pastMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const lastUserMsg = pastMessages.slice(-1)[0]?.content || aiMessage;

    const chat = geminiModel.startChat({
      history: geminiHistory,
      systemInstruction: systemPrompt + '\n\n' + memoryContext,
      generationConfig: {
        temperature: 0.92,
        maxOutputTokens: 600,
        responseMimeType: 'application/json'
      }
    });

    const result = await chat.sendMessage(lastUserMsg);
    const raw = result.response.text();

    history.push({ role:'assistant', content:raw });
    saveChatHistory(id, history);

    let parsed;
    try { parsed = JSON.parse(raw.replace(/^```json/,'').replace(/```$/,'').trim()); }
    catch { parsed = { messages:[{ type:'text', content:'oops brain glitch 👻', textToRead:'oops' }] }; }

    // Process GIFs
    for (const msg of parsed.messages||[]) {
      if (msg.type==='gif' && msg.query) {
        const url = await fetchGif(msg.query);
        if (url) { msg.type='image'; msg.content=url; msg.isGif=true; }
        else { msg.type='text'; msg.content="couldn't load that gif 😅"; }
      }
    }

    // Memory updates
    if (parsed.memoryUpdates) {
      const mu = parsed.memoryUpdates;
      if (mu.newFact) memory.facts = [...new Set([...memory.facts, mu.newFact])].slice(-30);
      if (mu.emotionLog) memory.emotions = [...memory.emotions, { date:new Date().toISOString().split('T')[0], emotion:mu.emotionLog, context:'AI observed' }].slice(-20);
      if (mu.importantMoment) memory.importantMoments = [...(memory.importantMoments||[]), mu.importantMoment].slice(-10);
    }

    if (parsed.messages?.length) {
      memory.affection = Math.min(100, (memory.affection||0) + 8);
    }

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
