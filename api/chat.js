const MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAIN_PICK = 6;
const MAX_NUMBER = 45;
const BONUS_POOL = MAX_NUMBER - MAIN_PICK;
const MAIN_COMBINATIONS = 8145060;
const FULL_SET_COMBINATIONS = MAIN_COMBINATIONS * BONUS_POOL;

const SYSTEM_PROMPT = `당신은 한국 로또 6/45 추첨기의 설명 챗봇입니다.
역할:
- 사용자가 방금 추첨한 번호가 왜 나왔는지, 확률 관점에서 친절하게 설명합니다.
- 모든 번호는 1~45에서 중복 없이 균등 확률로 뽑혔다는 점을 분명히 합니다.
- 특정 번호가 "운이 좋다/나쁘다"거나 당첨을 예측한다고 말하지 않습니다.
- 제공된 probabilityStats JSON의 수치를 근거로 설명합니다.
- 한국어로 답하고, 짧은 문단과 불릿을 적절히 섞습니다.
- 오락용 도구이며 당첨을 보장하지 않는다고 한 번 언급합니다.`;

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
  return `방금 추첨이 끝났습니다. 아래 결과와 확률 통계를 바탕으로, 왜 이 번호들이 나왔는지(무작위 추첨 관점)와 각 확률의 의미를 설명해 주세요.

추첨 결과:
${JSON.stringify(stats.sets, null, 2)}

확률 통계:
${JSON.stringify(stats, null, 2)}`;
}

function buildFollowUpPrompt(message, sets, stats, history) {
  const transcript = history
    .map((entry) => `${entry.role === "user" ? "사용자" : "챗봇"}: ${entry.text}`)
    .join("\n");

  return `추첨 결과와 확률 통계는 아래와 같습니다.

추첨 결과:
${JSON.stringify(stats.sets, null, 2)}

확률 통계:
${JSON.stringify(stats, null, 2)}

이전 대화:
${transcript}

사용자의 새 질문:
${message}

위 맥락을 유지하며 확률 기반으로 답변해 주세요.`;
}

function toGeminiContents(prompt) {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200,
    },
  };
}

async function callGemini(apiKey, body) {
  const response = await fetch(GEMINI_URL, {
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
    throw new Error(message);
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
      model: MODEL,
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
    const prompt = message.trim()
      ? buildFollowUpPrompt(message.trim(), sets, stats, history)
      : buildInitialPrompt(sets, stats);

    const reply = await callGemini(apiKey, toGeminiContents(prompt));

    return res.status(200).json({ reply, stats });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error.",
    });
  }
}
