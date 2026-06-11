import { initHistory } from "./history.js";
import { explainDraw, initChatbot } from "./chatbot.js";
import { initSignupModal, showSignupPrompt } from "./signup-modal.js";
import {
  animateTicketDraw,
  createDrawStage,
  finishDrawStage,
  SET_GAP_MS,
} from "./draw-animation.js";

const MIN_NUMBER = 1;
const MAX_NUMBER = 45;
const PICK_COUNT = 6;
const MIN_SETS = 1;
const MAX_SETS = 5;

const setCountEl = document.getElementById("set-count");
const decreaseBtn = document.getElementById("decrease");
const increaseBtn = document.getElementById("increase");
const drawBtn = document.getElementById("draw-btn");
const resultsEl = document.getElementById("results");
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");

let setCount = 1;
let isDrawing = false;

function drawLottoNumbers() {
  const pool = Array.from({ length: MAX_NUMBER }, (_, i) => i + MIN_NUMBER);
  const main = [];

  for (let i = 0; i < PICK_COUNT; i++) {
    const index = Math.floor(Math.random() * pool.length);
    main.push(pool.splice(index, 1)[0]);
  }

  const bonusIndex = Math.floor(Math.random() * pool.length);
  const bonus = pool[bonusIndex];

  return { main: main.sort((a, b) => a - b), bonus };
}

function setControlsDisabled(disabled) {
  drawBtn.disabled = disabled;
  decreaseBtn.disabled = disabled || setCount <= MIN_SETS;
  increaseBtn.disabled = disabled || setCount >= MAX_SETS;
}

function updateSetCountDisplay() {
  setCountEl.textContent = String(setCount);
  if (!isDrawing) {
    decreaseBtn.disabled = setCount <= MIN_SETS;
    increaseBtn.disabled = setCount >= MAX_SETS;
  }
}

async function draw() {
  if (isDrawing) return;

  isDrawing = true;
  setControlsDisabled(true);
  drawBtn.classList.add("drawing");
  const chatbotPanel = document.getElementById("chatbot-panel");
  if (chatbotPanel) chatbotPanel.hidden = true;
  resultsEl.innerHTML = "";

  const { stage, machine, chuteBall, status } = createDrawStage();
  const ticketsEl = document.createElement("div");
  ticketsEl.className = "draw-tickets";

  resultsEl.append(stage, ticketsEl);

  const ctx = { machine, statusEl: status, chuteBall, ticketsEl };
  const drawnSets = [];

  try {
    for (let i = 0; i < setCount; i++) {
      if (i > 0) {
        status.textContent = "다음 세트 준비 중...";
        await new Promise((r) => setTimeout(r, SET_GAP_MS));
      }

      const result = drawLottoNumbers();
      drawnSets.push(result);
      await animateTicketDraw(result, i, ctx);
    }

    status.textContent = "모든 추첨이 완료되었습니다!";
    await finishDrawStage(stage);
    await explainDraw(drawnSets);
    showSignupPrompt();
  } finally {
    isDrawing = false;
    drawBtn.classList.remove("drawing");
    updateSetCountDisplay();
    setControlsDisabled(false);
  }
}

function switchTab(targetId) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === targetId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

decreaseBtn.addEventListener("click", () => {
  if (setCount > MIN_SETS) {
    setCount--;
    updateSetCountDisplay();
  }
});

increaseBtn.addEventListener("click", () => {
  if (setCount < MAX_SETS) {
    setCount++;
    updateSetCountDisplay();
  }
});

drawBtn.addEventListener("click", draw);

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

resultsEl.innerHTML =
  '<p class="empty-state">위 버튼을 눌러 번호를 추첨해 보세요.</p>';
updateSetCountDisplay();

initChatbot();
initSignupModal();

initHistory({
  listEl: document.getElementById("history-list"),
  searchEl: document.getElementById("history-search"),
  countEl: document.getElementById("history-count"),
  statusEl: document.getElementById("history-status"),
});
