const API_URL = "/api/chat";

let panelEl;
let messagesEl;
let formEl;
let inputEl;
let currentSets = [];
let history = [];
let isLoading = false;

function createMessage(role, text) {
  const item = document.createElement("div");
  item.className = `chatbot-message chatbot-message--${role}`;

  const label = document.createElement("p");
  label.className = "chatbot-message-label";
  label.textContent = role === "user" ? "You" : "Explain";

  const body = document.createElement("div");
  body.className = "chatbot-message-body";
  body.textContent = text;

  item.append(label, body);
  return item;
}

function appendMessage(role, text) {
  const item = createMessage(role, text);
  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return item;
}

function setLoading(active) {
  isLoading = active;
  inputEl.disabled = active;
  formEl.querySelector("button").disabled = active;
}

async function requestChat(message = "", priorHistory = history) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sets: currentSets,
      message,
      history: priorHistory,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data.error || "챗봇 응답을 가져오지 못했습니다.";
    if (/quota|rate limit|한도/i.test(message)) {
      throw new Error(
        "Gemini API 무료 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 Google AI Studio에서 사용량을 확인해 주세요.",
      );
    }
    throw new Error(message);
  }

  return data;
}

async function sendMessage(message) {
  if (!currentSets.length || isLoading) return;

  const trimmed = message.trim();
  if (!trimmed && history.length > 0) return;

  const priorHistory = [...history];

  if (trimmed) {
    appendMessage("user", trimmed);
  }

  setLoading(true);
  const pending = appendMessage("assistant", "확률을 계산하고 설명을 준비하는 중…");
  pending.classList.add("is-pending");

  try {
    const result = await requestChat(trimmed, priorHistory);
    pending.classList.remove("is-pending");
    pending.querySelector(".chatbot-message-body").textContent = result.reply;
    if (trimmed) {
      history.push({ role: "user", text: trimmed });
    }
    history.push({ role: "assistant", text: result.reply });
  } catch (error) {
    pending.classList.remove("is-pending");
    pending.querySelector(".chatbot-message-body").textContent =
      error instanceof Error
        ? error.message
        : "설명을 불러오는 중 오류가 발생했습니다.";
  } finally {
    setLoading(false);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

export function initChatbot() {
  panelEl = document.getElementById("chatbot-panel");
  messagesEl = document.getElementById("chatbot-messages");
  formEl = document.getElementById("chatbot-form");
  inputEl = document.getElementById("chatbot-input");

  if (!panelEl || !messagesEl || !formEl || !inputEl) return;

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = inputEl.value;
    inputEl.value = "";
    await sendMessage(value);
  });

  document.addEventListener("lotto-draw-complete", (event) => {
    explainDraw(event.detail?.sets ?? []);
  });
}

export async function explainDraw(sets) {
  if (!panelEl || !sets.length) return;

  currentSets = sets.map((set) => ({
    main: [...set.main],
    bonus: set.bonus,
  }));
  history = [];
  messagesEl.innerHTML = "";
  panelEl.hidden = false;

  appendMessage(
    "assistant",
    "추첨이 완료되었습니다. Gemini가 확률 통계를 바탕으로 이번 번호를 설명합니다.",
  );

  await sendMessage("");
}
