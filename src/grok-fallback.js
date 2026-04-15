// Grok (xAI) API Fallback for Trivia Questions
// Hybrid approach: Local solver → Cache → Grok API (confidence >= 0.8) → Submit → Write-back cache

import { CONFIG } from './config.js';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = './facts.json';
const API_TIMEOUT_MS = 2000; // 2 second max
const CONFIDENCE_THRESHOLD = 0.8;
const MIN_SLOTS_FOR_API = 10; // Don't use API if slots < 10
const MIN_TIME_FOR_API = 5000; // Don't use API if < 5s remaining

// In-memory cache
let factsCache = new Map();

// Load cache from file on startup
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    for (const [key, value] of Object.entries(data)) {
      factsCache.set(key, value);
    }
    console.log(`[GROK] Loaded ${factsCache.size} facts from cache`);
  }
} catch (e) {
  console.error('[GROK] Cache load error:', e.message);
}

// Normalize question for cache key
function normalizeQuestion(q) {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100); // First 100 chars as key
}

// Save cache to file
function saveCache() {
  try {
    const data = Object.fromEntries(factsCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[GROK] Cache save error:', e.message);
  }
}

// Call Grok API with structured output
async function callGrokAPI(question, roundInfo = {}) {
  const apiKey = process.env.XAI_API_KEY || CONFIG.XAI_API_KEY;
  if (!apiKey) {
    console.log('[GROK] No API key configured');
    return null;
  }

  // Skip if conditions not met
  if (roundInfo.slots !== undefined && roundInfo.slots < MIN_SLOTS_FOR_API) {
    console.log(`[GROK] Skip: only ${roundInfo.slots} slots left`);
    return null;
  }
  if (roundInfo.timeRemaining !== undefined && roundInfo.timeRemaining < MIN_TIME_FOR_API) {
    console.log(`[GROK] Skip: only ${roundInfo.timeRemaining}ms left`);
    return null;
  }

  const model = process.env.XAI_MODEL || CONFIG.XAI_MODEL || 'grok-4';
  
  const schema = {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The answer to the question' },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
      answer_type: { type: 'string', description: 'Type: person_name, place, number, etc' },
      normalized_answer: { type: 'string', description: 'Lowercase, clean answer' }
    },
    required: ['answer', 'confidence', 'normalized_answer']
  };

  const prompt = `Answer this trivia question concisely:\n\n${question}\n\nProvide only the answer in the required JSON format.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'answer_schema',
            schema: schema
          }
        },
        max_tokens: 100,
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[GROK] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content);
    
    console.log(`[GROK] Answer: "${result.answer}" (confidence: ${result.confidence})`);
    
    if (result.confidence >= CONFIDENCE_THRESHOLD) {
      return result.normalized_answer || result.answer;
    }
    
    console.log(`[GROK] Confidence too low: ${result.confidence}`);
    return null;
    
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('[GROK] Timeout - API too slow');
    } else {
      console.log(`[GROK] Error: ${e.message}`);
    }
    return null;
  }
}

// Main fallback function
export async function grokFallback(question, roundInfo = {}) {
  // 1. Check cache first
  const cacheKey = normalizeQuestion(question);
  if (factsCache.has(cacheKey)) {
    console.log(`[GROK] Cache hit: "${factsCache.get(cacheKey)}"`);
    return factsCache.get(cacheKey);
  }

  // 2. Call Grok API
  const answer = await callGrokAPI(question, roundInfo);
  
  if (answer) {
    // 3. Save to cache (write-back)
    factsCache.set(cacheKey, answer);
    saveCache();
    console.log(`[GROK] Cached: "${answer}"`);
  }
  
  return answer;
}

// Get cache stats
export function getCacheStats() {
  return {
    size: factsCache.size,
    file: CACHE_FILE
  };
}
