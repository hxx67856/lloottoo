import { createBall, getBallColorRange } from "./utils.js";

const SHUFFLE_MS = 320;
const REVEAL_MS = 100;
const BALL_GAP_MS = 50;
const BONUS_GAP_MS = 120;
const SET_GAP_MS = 250;
const FINISH_MS = 300;

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
      const interval = 55;

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

function placeBallInSlot(slot, number, isBonus = false) {
  slot.classList.add("is-filled");
  const ball = createBall(number, { animate: false, bonus: isBonus });
  ball.classList.add("ball-landed-soft");
  slot.replaceChildren(ball);
}

async function revealBall(chuteBall, slot, number, machine, isBonus = false) {
  await shuffleInChute(chuteBall, machine, SHUFFLE_MS);

  chuteBall.textContent = number;
  chuteBall.dataset.range = getBallColorRange(number);
  chuteBall.classList.toggle("is-bonus", isBonus);
  chuteBall.classList.remove("is-shuffling");
  chuteBall.classList.add("is-revealed");
  await sleep(REVEAL_MS);

  resetChuteBall(chuteBall);
  placeBallInSlot(slot, number, isBonus);
}

export async function animateTicketDraw(
  result,
  setIndex,
  { machine, statusEl, chuteBall, ticketsEl },
) {
  const { ticket, mainSlots, bonusSlot, separator, bonusGroup } =
    createDrawingTicket(setIndex);
  ticketsEl.appendChild(ticket);
  const main = [...result.main].sort((a, b) => a - b);

  for (let i = 0; i < main.length; i++) {
    statusEl.textContent = `세트 ${setIndex + 1} · ${i + 1}번째 공 추첨 중`;
    await revealBall(chuteBall, mainSlots[i], main[i], machine);
    if (i < main.length - 1) await sleep(BALL_GAP_MS);
  }

  separator.classList.remove("is-hidden");
  bonusGroup.classList.remove("is-hidden");
  statusEl.textContent = `세트 ${setIndex + 1} · 보너스 번호 추첨 중`;
  await sleep(BONUS_GAP_MS);

  await revealBall(chuteBall, bonusSlot, result.bonus, machine, true);

  statusEl.textContent = `세트 ${setIndex + 1} 추첨 완료!`;
  ticket.classList.remove("ticket-drawing");
  ticket.classList.add("ticket-complete");
  return ticket;
}

export { SET_GAP_MS, FINISH_MS };

export async function finishDrawStage(stage) {
  stage.classList.add("is-finished");
  await sleep(FINISH_MS);
}
