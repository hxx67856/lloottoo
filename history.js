import { renderDrawRow } from "./utils.js";

const HISTORY_URL_LOCAL = "/data/lotto-history.json";
const HISTORY_URL_REMOTE = "https://smok95.github.io/lotto/results/all.json";

export async function loadHistory(remoteOnly = false) {
  if (!remoteOnly) {
    try {
      const res = await fetch(HISTORY_URL_LOCAL);
      if (res.ok) return await res.json();
    } catch {
      /* fallback to remote */
    }
  }

  const res = await fetch(HISTORY_URL_REMOTE);
  if (!res.ok) throw new Error("역대 당첨번호를 불러오지 못했습니다.");
  return res.json();
}

function formatDate(isoDate) {
  return isoDate.slice(0, 10);
}

function formatPrize(prize) {
  if (!prize) return null;

  const eok = Math.floor(prize / 100000000);
  const man = Math.floor((prize % 100000000) / 10000);

  if (eok > 0 && man > 0) {
    return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
  }
  if (eok > 0) return `${eok.toLocaleString("ko-KR")}억원`;
  return `${prize.toLocaleString("ko-KR")}원`;
}

function extractFirstPrize(divisions) {
  const first = divisions?.[0];
  if (!first?.prize || first.winners == null) {
    return { prize: null, winners: null };
  }
  return { prize: first.prize, winners: first.winners };
}

function normalizeDraw(draw) {
  const { prize, winners } = extractFirstPrize(draw.divisions);

  return {
    drawNo: draw.draw_no,
    main: draw.numbers,
    bonus: draw.bonus_no,
    date: formatDate(draw.date),
    prize,
    winners,
  };
}

function matchesSearch(draw, query) {
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (/^\d+$/.test(trimmed)) {
    return String(draw.drawNo).includes(trimmed);
  }

  const nums = trimmed.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= 45);
  if (nums.length === 0) return true;

  const all = [...draw.main, draw.bonus];
  return nums.every((n) => all.includes(n));
}

function renderHistoryItem(draw) {
  const item = document.createElement("article");
  item.className = "history-item";
  item.dataset.drawNo = String(draw.drawNo);

  const meta = document.createElement("div");
  meta.className = "history-meta";

  const drawNo = document.createElement("span");
  drawNo.className = "history-draw-no";
  drawNo.textContent = `${draw.drawNo}회`;

  const date = document.createElement("span");
  date.className = "history-date";
  date.textContent = draw.date;

  meta.append(drawNo, date);

  const info = document.createElement("div");
  info.className = "history-info";

  const prizeEl = document.createElement("span");
  prizeEl.className = "history-prize";
  const prizeText = formatPrize(draw.prize);
  prizeEl.textContent = prizeText ? `1등 ${prizeText}` : "1등 당첨금 정보 없음";

  const winnersEl = document.createElement("span");
  winnersEl.className = "history-winners";
  winnersEl.textContent =
    draw.winners != null ? `당첨 ${draw.winners.toLocaleString("ko-KR")}명` : "당첨자 정보 없음";

  info.append(prizeEl, winnersEl);
  item.append(meta, info, renderDrawRow(draw, { small: true, animate: false }));
  return item;
}

export function initHistory({
  listEl,
  searchEl,
  countEl,
  statusEl,
  remoteOnly = false,
}) {
  let allDraws = [];

  async function refresh() {
    statusEl.textContent = "역대 당첨번호를 불러오는 중...";
    listEl.innerHTML = "";

    try {
      const data = await loadHistory(remoteOnly);
      allDraws = data.map(normalizeDraw).sort((a, b) => b.drawNo - a.drawNo);
      renderList();
      statusEl.textContent = "";
    } catch {
      statusEl.textContent = "데이터를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.";
      countEl.textContent = "";
    }
  }

  function renderList() {
    const query = searchEl.value;
    const filtered = allDraws.filter((draw) => matchesSearch(draw, query));

    listEl.innerHTML = "";
    if (filtered.length === 0) {
      listEl.innerHTML = '<p class="empty-state">검색 결과가 없습니다.</p>';
      countEl.textContent = "0건";
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((draw) => fragment.appendChild(renderHistoryItem(draw)));
    listEl.appendChild(fragment);
    countEl.textContent = `${filtered.length}건`;
  }

  searchEl.addEventListener("input", renderList);
  refresh();
}
