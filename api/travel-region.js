import {
  isQuotaError,
  parseRetrySeconds,
} from "./local-explanation.js";
import { getRegionFallback } from "./travel-fallback.js";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    region: { type: "string" },
    summary: { type: "string" },
    landmarks: { type: "array", items: { type: "string" } },
    foods: { type: "array", items: { type: "string" } },
    festivals: { type: "array", items: { type: "string" } },
  },
  required: ["region", "summary", "landmarks", "foods", "festivals"],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey() {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return "";
}

function getModelCandidates() {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const models = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  return [...new Set(models)];
}

function buildPrompt(regionName) {
  return `Google 검색을 활용해 대한민국 "${regionName}"의 최신 관광 정보를 조사하세요.

다음 JSON 형식으로만 응답하세요:
- region: 지역명 (입력값 그대로)
- summary: 지역 한 줄 소개 (40자 내외)
- landmarks: 대표 랜드마크·명소 4개 (실제 장소명)
- foods: 대표 음식·향토 음식 4개
- festivals: 대표 축제·행사 3~4개 (실제 축제명)

규칙:
- 한국어로 작성
- 검색으로 확인 가능한 실제 정보 우선
- 각 항목은 짧은 명사구로`;
}

function extractSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const urls = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (uri && !urls.includes(uri)) {
      urls.push(uri);
    }
  }

  return urls.slice(0, 5);
}

function parseJsonResponse(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

async function callGeminiOnce(apiKey, model, regionName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(regionName) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `Gemini API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }

  const info = parseJsonResponse(text);
  return {
    info,
    sources: extractSources(data),
    model,
    source: "google",
  };
}

async function callGemini(apiKey, regionName) {
  const models = getModelCandidates();
  let lastError = null;

  for (const model of models) {
    try {
      return await callGeminiOnce(apiKey, model, regionName);
    } catch (error) {
      lastError = error;
      if (!isQuotaError(error.message)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Gemini API quota exceeded.");
}

async function callGeminiWithRetry(apiKey, regionName) {
  try {
    return await callGemini(apiKey, regionName);
  } catch (error) {
    if (!isQuotaError(error?.message)) {
      throw error;
    }

    const waitMs = parseRetrySeconds(error.message) * 1000;
    await sleep(waitMs);
    return callGemini(apiKey, regionName);
  }
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  const apiKey = getApiKey();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      keyConfigured: Boolean(apiKey),
      model: getModelCandidates()[0],
      expectedKey: "GEMINI_API_KEY",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { regionName } = parseBody(req);

    if (!regionName || typeof regionName !== "string") {
      return res.status(400).json({ error: "regionName is required." });
    }

    if (!apiKey) {
      const fallback = getRegionFallback(regionName);
      return res.status(200).json({
        regionName,
        ...fallback,
        source: "fallback",
        sources: [],
        note: "API 키 미설정 — 기본 지역 정보를 표시합니다.",
      });
    }

    try {
      const result = await callGeminiWithRetry(apiKey, regionName.trim());
      return res.status(200).json({
        regionName,
        summary: result.info.summary,
        landmarks: result.info.landmarks,
        foods: result.info.foods,
        festivals: result.info.festivals,
        source: result.source,
        sources: result.sources,
        model: result.model,
      });
    } catch (error) {
      if (!isQuotaError(error?.message)) {
        throw error;
      }

      const fallback = getRegionFallback(regionName);
      return res.status(200).json({
        regionName,
        ...fallback,
        source: "fallback",
        sources: [],
        quotaExceeded: true,
        note: "Google API 한도 초과 — 기본 지역 정보를 표시합니다.",
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
}
