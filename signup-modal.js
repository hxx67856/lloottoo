const API_URL = "/api/signup";

const TESTIMONIALS = [
  {
    name: "김민준",
    age: 34,
    prize: "1등",
    drawNo: 1182,
    quote:
      "AI 추천 번호로 1등에 당첨됐습니다. 매주 추천받은 조합 그대로 샀더니 꿈만 같아요.",
  },
  {
    name: "이서연",
    age: 28,
    prize: "2등",
    drawNo: 1204,
    quote:
      "처음엔 반신반의했는데 2등 당첨 후 바로 정기 구독 중입니다. 번호 선정이 정말 체계적이에요.",
  },
  {
    name: "박지훈",
    age: 41,
    prize: "1등",
    drawNo: 1216,
    quote:
      "통계와 AI 분석을 같이 봐주니 믿음이 갑니다. 이 서비스 덕분에 인생이 바뀌었습니다.",
  },
  {
    name: "최유나",
    age: 32,
    prize: "2등",
    drawNo: 1221,
    quote:
      "가입 후 받은 맞춤 번호로 2등 당첨! 주변에도 계속 추천하고 있습니다.",
  },
  {
    name: "정하늘",
    age: 37,
    prize: "1등",
    drawNo: 1225,
    quote:
      "AI가 추천한 세트 중 하나가 1등이었습니다. 알림만 켜두면 번호 고민이 끝나요.",
  },
];

let overlayEl;
let formEl;
let statusEl;
let testimonialsEl;
let isSubmitting = false;

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(digits);
}

function renderTestimonials() {
  if (!testimonialsEl) return;

  testimonialsEl.innerHTML = "";
  testimonialsEl.hidden = false;

  const header = document.createElement("div");
  header.className = "testimonials-header";
  header.innerHTML = `
    <p class="testimonials-eyebrow">Winners</p>
    <h2 class="testimonials-title">당첨 후기</h2>
    <p class="testimonials-desc">AI 번호 추천 서비스를 이용해 1등·2등에 당첨한 회원들의 이야기입니다.</p>
  `;
  testimonialsEl.appendChild(header);

  const list = document.createElement("div");
  list.className = "testimonials-list";

  TESTIMONIALS.forEach((item) => {
    const card = document.createElement("article");
    card.className = "testimonial-card";
    card.innerHTML = `
      <div class="testimonial-meta">
        <span class="testimonial-prize testimonial-prize--${item.prize === "1등" ? "first" : "second"}">${item.prize}</span>
        <span class="testimonial-draw">${item.drawNo}회</span>
      </div>
      <p class="testimonial-quote">"${item.quote}"</p>
      <p class="testimonial-author">${item.name} · ${item.age}세</p>
    `;
    list.appendChild(card);
  });

  testimonialsEl.appendChild(list);
}

function openOverlay() {
  if (!overlayEl) return;
  overlayEl.hidden = false;
  document.body.classList.add("modal-open");
  const firstInput = formEl?.querySelector("input");
  if (firstInput) firstInput.focus();
}

function closeOverlay() {
  if (!overlayEl) return;
  overlayEl.hidden = true;
  document.body.classList.remove("modal-open");
}

async function submitSignup(formData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "가입 신청에 실패했습니다.");
  }

  return data;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  const form = event.currentTarget;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim();

  if (!name) {
    statusEl.textContent = "이름을 입력해 주세요.";
    return;
  }
  if (!validatePhone(phone)) {
    statusEl.textContent = "올바른 연락처(휴대폰 번호)를 입력해 주세요.";
    return;
  }
  if (!validateEmail(email)) {
    statusEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
    return;
  }

  isSubmitting = true;
  statusEl.textContent = "가입 신청 중…";
  form.querySelector("button[type=submit]").disabled = true;

  try {
    await submitSignup({ name, phone, email });
    statusEl.textContent = "가입 신청이 완료되었습니다. 곧 AI 추천 번호를 보내드릴게요!";
    form.reset();
    setTimeout(() => {
      closeOverlay();
      statusEl.textContent = "";
    }, 1400);
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : "가입 신청 중 오류가 발생했습니다.";
  } finally {
    isSubmitting = false;
    form.querySelector("button[type=submit]").disabled = false;
  }
}

export function initSignupModal() {
  overlayEl = document.getElementById("signup-overlay");
  formEl = document.getElementById("signup-form");
  statusEl = document.getElementById("signup-status");
  testimonialsEl = document.getElementById("testimonials-section");

  if (!overlayEl || !formEl) return;

  formEl.addEventListener("submit", handleSubmit);

  overlayEl.querySelector(".signup-skip")?.addEventListener("click", closeOverlay);
  overlayEl.querySelector(".signup-overlay-backdrop")?.addEventListener("click", closeOverlay);
  overlayEl.querySelector(".signup-close")?.addEventListener("click", closeOverlay);

  document.addEventListener("lotto-draw-complete", () => {
    showSignupPrompt();
  });
}

export function showSignupPrompt() {
  renderTestimonials();
  openOverlay();
}
