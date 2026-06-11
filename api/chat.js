import {
  buildLocalExplanation,
  buildLocalFollowUpReply,
  isQuotaError,
  parseRetrySeconds,
} from "./local-explanation.js";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

const MAIN_PICK = 6;
const MAX_NUMBER = 45;
const BONUS_POOL = MAX_NUMBER - MAIN_PICK;
const MAIN_COMBINATIONS = 8145060;
const FULL_SET_COMBINATIONS = MAIN_COMBINATIONS * BONUS_POOL;

const SYSTEM_PROMPT = `한국 로또 6/45 추첨 결과의 확률만 간결히 요약합니다.

규칙:
- 3~5줄 이내, 불릿 2~4개만 사용
- 결론(확률 수치)만 말하고 부연·서론·반복 금지
- probabilityStats 수치만 인용
- 무작위 균등 추첨, 당첨 예측·보장 표현 금지
- 한국어, 오락용 안내는 마지막 1줄만`;

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

function getDrawProbabilityStats(sets) {
  const singleSetProbability = 1 / FULL_SET_COMBINATIONS;
  const anyMainNumberProbability = MAIN_PICK / MAX_NUMBER;
  const anyBonusProbability = 1 / BONUS_POOL;

  return {
    rules: {
      poolSize: MAX_NUMBER,
      mainPick: MAIN_PICK,
      bonusPick: 1,
      drawMethod: "중복 없는 무작위 추출 (균등 확률)",
    },
    combinations: {
      main: MAIN_COMBINATIONS,
      fullSet: FULL_SET_COMBINATIONS,
    },
    probabilities: {
      exactSet: singleSetProbability,
      exactSetPercent: (singleSetProbability * 100).toExponential(4),
      exactSetOdds: `1 : ${FULL_SET_COMBINATIONS.toLocaleString("ko-KR")}`,
      numberInMain: anyMainNumberProbability,
      numberInMainPercent: `${(anyMainNumberProbability * 100).toFixed(2)}%`,
      exactBonus: anyBonusProbability,
      exactBonusPercent: `${(anyBonusProbability * 100).toFixed(2)}%`,
      multiSet: {
        setCount: sets.length,
        atLeastOneExactSet: 1 - (1 - singleSetProbability) ** sets.length,
      },
    },
    sets: sets.map((set, index) => ({
      setIndex: index + 1,
      main: [...set.main].sort((a, b) => a - b),
      bonus: set.bonus,
      exactSetProbability: singleSetProbability,
      exactSetOdds: `1/${FULL_SET_COMBINATIONS.toLocaleString("ko-KR")}`,
    })),
  };
}

function buildInitialPrompt(sets, stats) {
  return `아래 데이터로 확률 결론만 짧게 요약하세요. 세트별 번호와 핵심 확률(정확 일치, 번호 포함, 보너스)만 bullet로 적으세요.

${JSON.stringify({ sets: stats.sets, probabilities: stats.probabilities }, null, 2)}`;
}

function buildFollowUpPrompt(message, stats) {
  return `아래 질문에만 확률 결론 1~3줄로 답하세요. 이전 답변을 반복하지 마세요.

질문: ${message}

참고 데이터:
${JSON.stringify({ sets: stats.sets, probabilities: stats.probabilities })}`;
}

function toGeminiContents({ prompt, history, isFollowUp }) {
  const generationConfig = {
    temperature: isFollowUp ? 0.55 : 0.35,
    maxOutputTokens: isFollowUp ? 220 : 280,
  };

  if (!isFollowUp) {
    return {
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }],
        },
      ],
      generationConfig,
    };
  }

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `${SYSTEM_PROMPT}\n\n추첨 데이터를 기억하고, 이후 질문마다 새로운 확률 결론만 짧게 답하세요.`,
        },
      ],
    },
    {
      role: "model",
      parts: [{ text: "네. 질문별로 다른 확률 결론만 짧게 답하겠습니다." }],
    },
  ];

  for (const entry of history) {
    contents.push({
      role: entry.role === "user" ? "user" : "model",
      parts: [{ text: entry.text }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  return { contents, generationConfig };
}

async function callGeminiOnce(apiKey, model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
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

  return text;
}

async function callGemini(apiKey, body) {
  const models = getModelCandidates();
  let lastError = null;

  for (const model of models) {
    try {
      return {
        reply: await callGeminiOnce(apiKey, model, body),
        model,
        source: "gemini",
      };
    } catch (error) {
      lastError = error;
      if (!isQuotaError(error.message)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Gemini API quota exceeded.");
}

async function callGeminiWithRetry(apiKey, body) {
  try {
    return await callGemini(apiKey, body);
  } catch (error) {
    if (!isQuotaError(error?.message)) {
      throw error;
    }

    const waitMs = parseRetrySeconds(error.message) * 1000;
    await sleep(waitMs);

    try {
      return await callGemini(apiKey, body);
    } catch (retryError) {
      throw retryError;
    }
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

function missingKeyResponse(res) {
  return res.status(500).json({
    error:
      "GEMINI_API_KEY is not configured. Vercel에서 환경 변수 이름을 GEMINI_API_KEY로 설정하고 Production/Preview 모두 체크한 뒤 Redeploy 해주세요.",
    keyConfigured: false,
    expectedKey: "GEMINI_API_KEY",
  });
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
      fallbackModels: getModelCandidates().slice(1),
      expectedKey: "GEMINI_API_KEY",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!apiKey) {
    return missingKeyResponse(res);
  }

  try {
    const { sets, message = "", history = [] } = parseBody(req);

    if (!Array.isArray(sets) || sets.length === 0) {
      return res.status(400).json({ error: "sets array is required." });
    }

    for (const set of sets) {
      if (!Array.isArray(set.main) || set.main.length !== 6 || !set.bonus) {
        return res.status(400).json({ error: "Invalid lotto set format." });
      }
    }

    const stats = getDrawProbabilityStats(sets);
    const trimmedMessage = message.trim();
    const isFollowUp = Boolean(trimmedMessage);
    const prompt = isFollowUp
      ? buildFollowUpPrompt(trimmedMessage, stats)
      : buildInitialPrompt(sets, stats);

    try {
      const result = await callGeminiWithRetry(
        apiKey,
        toGeminiContents({ prompt, history, isFollowUp }),
      );
      return res.status(200).json({
        reply: result.reply,
        stats,
        source: result.source,
        model: result.model,
      });
    } catch (error) {
      if (!isQuotaError(error?.message)) {
        throw error;
      }

      const fallbackReply = isFollowUp
        ? buildLocalFollowUpReply(trimmedMessage, stats)
        : buildLocalExplanation(stats);

      return res.status(200).json({
        reply: `${fallbackReply}\n(※ AI 한도 초과, 기본 답변)`,
        stats,
        source: "fallback",
        model: null,
        quotaExceeded: true,
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
}
