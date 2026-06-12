const KOREA_REGIONS = [
  { name: "서울특별시", lat: 37.5665, lng: 126.978, zoom: 11 },
  { name: "부산광역시", lat: 35.1796, lng: 129.0756, zoom: 11 },
  { name: "대구광역시", lat: 35.8714, lng: 128.6014, zoom: 11 },
  { name: "인천광역시", lat: 37.4563, lng: 126.7052, zoom: 11 },
  { name: "광주광역시", lat: 35.1595, lng: 126.8526, zoom: 11 },
  { name: "대전광역시", lat: 36.3504, lng: 127.3845, zoom: 11 },
  { name: "울산광역시", lat: 35.5384, lng: 129.3114, zoom: 11 },
  { name: "세종특별자치시", lat: 36.48, lng: 127.289, zoom: 12 },
  { name: "경기도", lat: 37.2752, lng: 127.0095, zoom: 9 },
  { name: "강원특별자치도", lat: 37.8228, lng: 128.1555, zoom: 9 },
  { name: "충청북도", lat: 36.6357, lng: 127.4917, zoom: 10 },
  { name: "충청남도", lat: 36.5184, lng: 126.8, zoom: 9 },
  { name: "전북특별자치도", lat: 35.8242, lng: 127.148, zoom: 10 },
  { name: "전라남도", lat: 34.8161, lng: 126.4629, zoom: 9 },
  { name: "경상북도", lat: 36.4919, lng: 128.8889, zoom: 9 },
  { name: "경상남도", lat: 35.4606, lng: 128.2132, zoom: 9 },
  { name: "제주특별자치도", lat: 33.4996, lng: 126.5312, zoom: 10 },
];

const KOREA_CENTER = { lat: 36.5, lng: 127.8, zoom: 7 };
const GOOGLE_MAPS_BASE = "https://www.google.co.kr/maps";
const API_URL = "/api/travel-region";
const CACHE_KEY = "travel-region-cache-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const mapFrame = document.getElementById("map-frame");
const mapIntro = document.getElementById("map-intro");
const mapLoading = document.getElementById("map-loading");
const loadingRegion = document.getElementById("loading-region");
const loadingCaption = mapLoading?.querySelector(".loading-caption");
const startBtn = document.getElementById("start-btn");
const retryBtn = document.getElementById("retry-btn");
const resultPanel = document.getElementById("result-panel");
const resultRegionName = document.getElementById("result-region-name");
const resultSummary = document.getElementById("result-summary");
const landmarksList = document.getElementById("landmarks-list");
const foodsList = document.getElementById("foods-list");
const festivalsList = document.getElementById("festivals-list");
const openMapsBtn = document.getElementById("open-maps-btn");
const infoSource = document.getElementById("info-source");

let isRunning = false;
let localRegionData = null;

function buildEmbedUrl(lat, lng, zoom = 13, query = "") {
  const q = query ? encodeURIComponent(query) : `${lat},${lng}`;
  return `https://maps.google.com/maps?q=${q}&ll=${lat},${lng}&z=${zoom}&hl=ko&output=embed`;
}

function buildMapsUrl(region) {
  const query = encodeURIComponent(region.name);
  return `${GOOGLE_MAPS_BASE}/search/${query}/@${region.lat},${region.lng},${region.zoom}z?entry=ttu`;
}

function setMapView(lat, lng, zoom, query = "") {
  mapFrame.src = buildEmbedUrl(lat, lng, zoom, query);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderList(listEl, items) {
  listEl.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function setSourceNote(data) {
  if (data.source === "google") {
    const sourceLinks = (data.sources ?? [])
      .slice(0, 3)
      .map((url) => {
        let label = "Google 검색";
        try {
          label = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          /* keep default */
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .join(" · ");

    infoSource.innerHTML = sourceLinks
      ? `정보 출처: Google 검색 (${sourceLinks})`
      : "정보 출처: Google 검색";
    return;
  }

  if (data.source === "loading") {
    infoSource.textContent = "기본 정보를 먼저 표시했습니다. Google 최신 정보를 불러오는 중…";
    return;
  }

  infoSource.textContent =
    data.note ?? "기본 지역 정보를 표시합니다.";
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or private mode */
  }
}

function getCachedRegionInfo(regionName) {
  const entry = readCache()[regionName];
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCachedRegionInfo(regionName, data) {
  if (data.source !== "google") return;
  const cache = readCache();
  cache[regionName] = { ts: Date.now(), data };
  writeCache(cache);
}

async function loadLocalRegionData() {
  if (localRegionData) return localRegionData;
  const response = await fetch(`${import.meta.env.BASE_URL}data/travel-regions.json`);
  if (!response.ok) throw new Error("로컬 지역 데이터를 불러오지 못했습니다.");
  localRegionData = await response.json();
  return localRegionData;
}

async function getLocalFallback(regionName) {
  const local = await loadLocalRegionData();
  const fallback = local.fallback[regionName];
  if (!fallback) throw new Error("지역 정보를 찾지 못했습니다.");
  return {
    regionName,
    ...fallback,
    source: "fallback",
    sources: [],
  };
}

async function fetchGoogleRegionInfo(regionName) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regionName }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "지역 정보를 가져오지 못했습니다.");
  }

  if (data.source === "google") {
    setCachedRegionInfo(regionName, data);
  }

  return data;
}

function showResult(region, data, { scroll = true } = {}) {
  resultRegionName.textContent = region.name;
  resultSummary.textContent = data.summary;
  renderList(landmarksList, data.landmarks ?? []);
  renderList(foodsList, data.foods ?? []);
  renderList(festivalsList, data.festivals ?? []);
  openMapsBtn.href = buildMapsUrl(region);
  setSourceNote(data);
  resultPanel.hidden = false;
  resultPanel.classList.add("is-visible");
  if (scroll) {
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function runPickAnimation(finalRegion) {
  const ticks = 7 + Math.floor(Math.random() * 4);
  let delay = 45;

  for (let i = 0; i < ticks; i += 1) {
    const preview = i === ticks - 1 ? finalRegion : pickRandom(KOREA_REGIONS);
    loadingRegion.textContent = preview.name;
    setMapView(preview.lat, preview.lng, preview.zoom, preview.name);
    await sleep(delay);
    delay = Math.min(delay + 12, 110);
  }
}

async function runRandomTrip() {
  if (isRunning) return;

  isRunning = true;
  startBtn.disabled = true;
  retryBtn.disabled = true;
  if (mapIntro) mapIntro.hidden = true;
  resultPanel.hidden = true;
  resultPanel.classList.remove("is-visible");
  mapLoading.hidden = false;
  if (loadingCaption) loadingCaption.textContent = "여행지를 고르는 중…";

  const finalRegion = pickRandom(KOREA_REGIONS);
  const cached = getCachedRegionInfo(finalRegion.name);

  const googlePromise = cached ? null : fetchGoogleRegionInfo(finalRegion.name).catch(() => null);

  await runPickAnimation(finalRegion);
  mapLoading.hidden = true;

  try {
    if (cached) {
      showResult(finalRegion, cached);
      return;
    }

    const localData = await getLocalFallback(finalRegion.name);
    showResult(finalRegion, { ...localData, source: "loading" });

    const googleData = await googlePromise;
    if (googleData?.source === "google") {
      showResult(finalRegion, googleData, { scroll: false });
      return;
    }

    setSourceNote(localData);
  } catch (error) {
    if (mapIntro) {
      mapIntro.hidden = false;
      const desc = mapIntro.querySelector(".map-intro-desc");
      if (desc) {
        desc.textContent =
          error instanceof Error ? error.message : "다시 시도해 주세요.";
      }
    }
  } finally {
    isRunning = false;
    startBtn.disabled = false;
    retryBtn.disabled = false;
  }
}

function resetToHome() {
  resultPanel.hidden = true;
  resultPanel.classList.remove("is-visible");
  mapLoading.hidden = true;
  if (mapIntro) {
    mapIntro.hidden = false;
    const desc = mapIntro.querySelector(".map-intro-desc");
    if (desc) {
      desc.textContent = "지도 위에서 전국 17개 시·도 중 한 곳을 무작위로 골라 드립니다.";
    }
  }
  loadingRegion.textContent = "";
  if (loadingCaption) loadingCaption.textContent = "여행지를 고르는 중…";
  setMapView(KOREA_CENTER.lat, KOREA_CENTER.lng, KOREA_CENTER.zoom, "대한민국");
}

function init() {
  if (!startBtn || !mapFrame) return;

  setMapView(KOREA_CENTER.lat, KOREA_CENTER.lng, KOREA_CENTER.zoom, "대한민국");
  loadLocalRegionData().catch(() => {});
  startBtn.addEventListener("click", runRandomTrip);
  retryBtn.addEventListener("click", () => {
    resetToHome();
    runRandomTrip();
  });
}

init();
