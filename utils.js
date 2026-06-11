export function getBallColorRange(num) {
  if (num <= 10) return "yellow";
  if (num <= 20) return "blue";
  if (num <= 30) return "red";
  if (num <= 40) return "gray";
  return "green";
}

export function createBall(num, { small = false, delayIndex = 0, animate = true, bonus = false } = {}) {
  const ball = document.createElement("div");
  ball.className = small ? "ball ball-sm" : "ball";
  if (bonus) ball.classList.add("is-bonus");
  ball.textContent = num;
  ball.dataset.range = getBallColorRange(num);
  if (animate) {
    ball.style.animationDelay = `${delayIndex * 0.07}s`;
  } else {
    ball.style.animation = "none";
  }
  return ball;
}

export function renderDrawRow({ main, bonus }, { small = false, animate = true } = {}) {
  const row = document.createElement("div");
  row.className = "balls-row";

  const balls = document.createElement("div");
  balls.className = "balls";
  main.forEach((num, i) => {
    balls.appendChild(createBall(num, { small, delayIndex: i, animate }));
  });

  const separator = document.createElement("span");
  separator.className = "bonus-separator";
  separator.textContent = "+";
  separator.setAttribute("aria-hidden", "true");

  const bonusGroup = document.createElement("div");
  bonusGroup.className = "bonus-group";

  const bonusLabel = document.createElement("span");
  bonusLabel.className = "bonus-label";
  bonusLabel.textContent = "보너스";

  bonusGroup.append(
    bonusLabel,
    createBall(bonus, { small, delayIndex: main.length, animate, bonus: true }),
  );

  row.append(balls, separator, bonusGroup);
  return row;
}
