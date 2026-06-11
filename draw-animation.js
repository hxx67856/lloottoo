import { createBall, getBallColorRange } from "./utils.js";

const EASE_SMOOTH = "cubic-bezier(0.22, 1, 0.36, 1)";
const BALL_SIZE = 48;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createBallSlot() {
  const slot = document.createElement("div");
  slot.className = "ball-slot";
  slot.innerHTML = '<span class="ball-slot-inner">?</span>';
  return slot;
}

export function createDrawStage() {
  const stage = document.createElement("div");
  stage.className = "draw-stage";

  const machine = document.createElement("div");
  machine.className = "lotto-machine";

  const body = document.createElement("div");
  body.className = "machine-body";

  const drum = document.createElement("div");
  drum.className = "machine-drum";
  drum.setAttribute("aria-hidden", "true");

  const drumBalls = document.createElement("div");
  drumBalls.className = "drum-balls";
  for (let i = 0; i < 10; i++) {
    const ball = document.createElement("span");
    ball.className = "drum-ball";
    ball.style.setProperty("--i", String(i));
    ball.textContent = Math.floor(Math.random() * 45) + 1;
    drumBalls.appendChild(ball);
  }

  const neck = document.createElement("div");
  neck.className = "machine-neck";

  const chute = document.createElement("div");
  chute.className = "machine-chute";

  const chuteBall = document.createElement("div");
  chuteBall.className = "chute-ball";
  chuteBall.textContent = "?";

  const status = document.createElement("p");
  status.className = "machine-status";
  status.textContent = "추첨기 준비 완료";

  chute.appendChild(chuteBall);
  drum.appendChild(drumBalls);
  body.append(drum, neck, chute);
  machine.append(body, status);
  stage.appendChild(machine);

  return { stage, machine, chuteBall, status };
}

function createDrawingTicket(setIndex) {
  const ticket = document.createElement("article");
  ticket.className = "ticket ticket-drawing";

  const label = document.createElement("p");
  label.className = "ticket-label";
  label.textContent = `세트 ${setIndex + 1}`;

  const row = document.createElement("div");
  row.className = "balls-row";

  const balls = document.createElement("div");
  balls.className = "balls";

  const mainSlots = [];
  for (let i = 0; i < 6; i++) {
    const slot = createBallSlot();
    mainSlots.push(slot);
    balls.appendChild(slot);
  }

  const separator = document.createElement("span");
  separator.className = "bonus-separator is-hidden";
  separator.textContent = "+";
  separator.setAttribute("aria-hidden", "true");

  const bonusGroup = document.createElement("div");
  bonusGroup.className = "bonus-group is-hidden";

  const bonusLabel = document.createElement("span");
  bonusLabel.className = "bonus-label";
  bonusLabel.textContent = "보너스";

  const bonusSlot = createBallSlot();
  bonusGroup.append(bonusLabel, bonusSlot);

  row.append(balls, separator, bonusGroup);
  ticket.append(label, row);

  return { ticket, mainSlots, bonusSlot, separator, bonusGroup };
}

function resetChuteBall(chuteBall) {
  chuteBall.classList.remove("is-revealed", "is-emptying", "is-bonus");
  chuteBall.textContent = "?";
  delete chuteBall.dataset.range;
}

async function shuffleInChute(chuteBall, machine, duration) {
  machine.classList.add("is-shaking");
  chuteBall.classList.remove("is-revealed", "is-emptying", "is-bonus");
  chuteBall.classList.add("is-shuffling");
  chuteBall.textContent = "?";
  delete chuteBall.dataset.range;

  const start = performance.now();
  let lastChange = 0;

  return new Promise((resolve) => {
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const interval = 45 + progress ** 2.2 * 280;

      if (now - lastChange >= interval) {
        const n = Math.floor(Math.random() * 45) + 1;
        chuteBall.classList.add("is-ticking");
        chuteBall.textContent = n;
        chuteBall.dataset.range = getBallColorRange(n);
        requestAnimationFrame(() => chuteBall.classList.remove("is-ticking"));
        lastChange = now;
      }

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        machine.classList.remove("is-shaking");
        chuteBall.classList.remove("is-shuffling");
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

function createFlyer(number, fromRect, isBonus = false) {
  const half = BALL_SIZE / 2;
  const flyer = createBall(number, { animate: false, bonus: isBonus });
  flyer.className = "ball ball-flyer";
  flyer.style.cssText = `
    position: fixed;
    left: ${fromRect.left + fromRect.width / 2 - half}px;
    top: ${fromRect.top + fromRect.height / 2 - half}px;
    width: ${BALL_SIZE}px;
    height: ${BALL_SIZE}px;
    z-index: 9999;
    margin: 0;
    pointer-events: none;
    will-change: transform, opacity;
  `;
  return flyer;
}

async function flyBallToSlot(chuteBall, slot, number, isBonus = false) {
  const fromRect = chuteBall.getBoundingClientRect();
  const toRect = slot.getBoundingClientRect();
  const half = BALL_SIZE / 2;

  const fromX = fromRect.left + fromRect.width / 2 - half;
  const fromY = fromRect.top + fromRect.height / 2 - half;
  const toX = toRect.left + toRect.width / 2 - half;
  const toY = toRect.top + toRect.height / 2 - half;
  const dx = toX - fromX;
  const dy = toY - fromY;

  const flyer = createFlyer(number, fromRect, isBonus);
  document.body.appendChild(flyer);

  chuteBall.classList.add("is-emptying");

  const anim = flyer.animate(
    [
      { transform: "translate(0, 0) scale(1.14)", opacity: 1 },
      {
        transform: `translate(${dx * 0.4}px, ${dy * 0.62}px) scale(1.06)`,
        opacity: 1,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
    ],
    { duration: 780, easing: EASE_SMOOTH, fill: "forwards" },
  );

  await anim.finished;
  flyer.remove();
  resetChuteBall(chuteBall);

  slot.classList.add("is-filled");
  const ball = createBall(number, { animate: false, bonus: isBonus });
  ball.classList.add("ball-landed-soft");
  slot.replaceChildren(ball);
}

async function revealBall(chuteBall, slot, number, machine, shuffleMs, isBonus = false) {
  await shuffleInChute(chuteBall, machine, shuffleMs);

  chuteBall.textContent = number;
  chuteBall.dataset.range = getBallColorRange(number);
  chuteBall.classList.toggle("is-bonus", isBonus);
  chuteBall.classList.remove("is-shuffling");
  chuteBall.classList.add("is-revealed");
  await sleep(480);

  await flyBallToSlot(chuteBall, slot, number, isBonus);
  await sleep(120);
}

export async function animateTicketDraw(
  result,
  setIndex,
  { machine, statusEl, chuteBall, fast = false },
) {
  const { ticket, mainSlots, bonusSlot, separator, bonusGroup } =
    createDrawingTicket(setIndex);
  const shuffleMs = fast ? 900 : 1500;
  const pauseMs = fast ? 280 : 480;
  const main = [...result.main].sort((a, b) => a - b);

  for (let i = 0; i < main.length; i++) {
    statusEl.textContent = `세트 ${setIndex + 1} · ${i + 1}번째 공 추첨 중`;
    await revealBall(chuteBall, mainSlots[i], main[i], machine, shuffleMs);
    await sleep(pauseMs);
  }

  separator.classList.remove("is-hidden");
  bonusGroup.classList.remove("is-hidden");
  statusEl.textContent = `세트 ${setIndex + 1} · 보너스 번호 추첨 중`;
  await sleep(fast ? 520 : 850);

  await revealBall(
    chuteBall,
    bonusSlot,
    result.bonus,
    machine,
    shuffleMs + 200,
    true,
  );

  statusEl.textContent = `세트 ${setIndex + 1} 추첨 완료!`;
  ticket.classList.remove("ticket-drawing");
  ticket.classList.add("ticket-complete");
  return ticket;
}

export async function finishDrawStage(stage) {
  stage.classList.add("is-finished");
  await sleep(1000);
}
