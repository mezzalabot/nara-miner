// Grok (xAI) API Fallback for Trivia Questions - v3.0
// Hybrid approach: Local solver → Cache → Grok-4-1-fast → Grok-4.20-reasoning (escalation)
// From GPT-5.4: Two-tier fallback with smart conditions

import OpenAI from 'openai';
import fs from 'fs';
import { CONFIG } from './config.js';

const XAI_API_KEY = process.env.XAI_API_KEY || CONFIG.XAI_API_KEY;
const FACT_CACHE_PATH = process.env.FACT_CACHE_PATH || './facts-cache.json';

const grok = XAI_API_KEY
  ? new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
      timeout: 1800,
    })
  : null;

function loadCache() {
  try {
    if (!fs.existsSync(FACT_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(FACT_CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(FACT_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // ignore cache write failure
  }
}

const factCache = loadCache();

function normalizeQuestionKey(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“""]/g, '"')
    .replace(/[‘'']/g, "'")
    .trim();
}

function cleanModelAnswer(answer) {
  return String(answer || '')
    .replace(/^[\"'`\s]+|[\"'`\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOutputText(resp) {
  if (typeof resp?.output_text === 'string' && resp.output_text.trim()) {
    return resp.output_text.trim();
  }

  const chunks = [];
  for (const item of resp?.output || []) {
    if (item?.type !== 'message') continue;
    for (const c of item?.content || []) {
      if (typeof c?.text === 'string') chunks.push(c.text);
      else if (typeof c?.value === 'string') chunks.push(c.value);
    }
  }
  return chunks.join(' ').trim();
}

function shouldUseApiFallback({ timeLeftMs = 999999, remainingSlots = 999, force = false } = {}) {
  if (force) return true;
  if (timeLeftMs < 2500) return false;
  if (remainingSlots <= 0) return false;
  return true;
}

function shouldEscalateToReasoning({ timeLeftMs = 999999, remainingSlots = 999 } = {}) {
  if (timeLeftMs < 5000) return false;
  if (remainingSlots <= 2) return false;
  return true;
}

const SYSTEM_PROMPT = [
  'You answer quiz and trivia questions for an automated verifier.',
  'Return ONLY the final answer text.',
  'No explanation. No JSON. No bullets. No quotes.',
  'Use canonical capitalization for proper nouns.',
  'For multiple choice questions, return the FULL answer text, not the option letter.',
  'For numeric answers, return digits only unless units are explicitly required.',
  'Do not add extra words like "the answer is".',
].join(' ');

async function askGrok(question, model, timeoutMs) {
  if (!grok) return null;

  const client = new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
    timeout: timeoutMs,
  });

  const resp = await client.responses.create({
    model,
    store: false,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: String(question || '').trim() },
    ],
  });

  return cleanModelAnswer(extractOutputText(resp));
}

function isUsableAnswer(answer) {
  if (!answer) return false;
  if (answer.length > 120) return false;
  if (/^(sorry|i don't know|unknown|not sure|cannot determine)\b/i.test(answer)) return false;
  return true;
}

// Main fallback function with two-tier escalation
export async function grokFallback(question, context = {}) {
  const key = normalizeQuestionKey(question);

  // Check cache first
  if (factCache[key]) {
    console.log(`[GROK] Cache hit: "${factCache[key]}"`);
    return {
      answer: factCache[key],
      source: 'cache',
    };
  }

  // Check if should use API
  if (!shouldUseApiFallback(context)) {
    console.log(`[GROK] Skip API: timeLeft=${context.timeLeftMs}ms, slots=${context.remainingSlots}`);
    return null;
  }

  // Tier 1: Fast model (non-reasoning)
  try {
    console.log(`[GROK] Trying grok-4-1-fast...`);
    const fastAnswer = await askGrok(
      question,
      'grok-4-1-fast-non-reasoning',
      1400
    );

    if (isUsableAnswer(fastAnswer)) {
      factCache[key] = fastAnswer;
      saveCache(factCache);
      console.log(`[GROK] Fast success: "${fastAnswer}"`);
      return {
        answer: fastAnswer,
        source: 'grok-fast',
      };
    }
  } catch (e) {
    console.log(`[GROK] Fast failed: ${e.message}`);
    // Continue to reasoning tier
  }

  // Tier 2: Escalate to reasoning model (if conditions allow)
  if (!shouldEscalateToReasoning(context)) {
    console.log(`[GROK] Skip reasoning tier: timeLeft=${context.timeLeftMs}ms, slots=${context.remainingSlots}`);
    return null;
  }

  try {
    console.log(`[GROK] Escalating to grok-4.20-reasoning...`);
    const slowAnswer = await askGrok(
      question,
      'grok-4.20-reasoning',
      2600
    );

    if (isUsableAnswer(slowAnswer)) {
      factCache[key] = slowAnswer;
      saveCache(factCache);
      console.log(`[GROK] Reasoning success: "${slowAnswer}"`);
      return {
        answer: slowAnswer,
        source: 'grok-4.20',
      };
    }
  } catch (e) {
    console.log(`[GROK] Reasoning failed: ${e.message}`);
    return null;
  }

  return null;
}

// Get cache stats
export function getCacheStats() {
  return {
    size: Object.keys(factCache).length,
    file: FACT_CACHE_PATH,
  };
}
