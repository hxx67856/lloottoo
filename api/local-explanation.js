export function buildLocalExplanation(stats, message = "") {
  const setLines = stats.sets.map((set) => {
    const nums = set.main.join(", ");
    return `세트${set.setIndex} [${nums}] +${set.bonus} → ${set.exactSetOdds}`;
  });

  const lines = [
    ...setLines,
    `번호 1개 포함 확률: ${stats.probabilities.numberInMainPercent}`,
    `보너스 특정 번호 확률: ${stats.probabilities.exactBonusPercent}`,
  ];

  if (stats.sets.length > 1) {
    lines.push(
      `${stats.sets.length}세트 중 1개 일치: ${(
        stats.probabilities.multiSet.atLeastOneExactSet * 100
      ).toFixed(4)}%`,
    );
  }

  if (message.trim()) {
    lines.push(buildLocalFollowUp(message.trim(), stats));
  }

  return lines.join("\n");
}

function buildLocalFollowUp(message, stats) {
  const lower = message.toLowerCase();

  if (lower.includes("확률") || lower.includes("당첨")) {
    return `→ 정확 일치: ${stats.probabilities.exactSetOdds}`;
  }

  if (lower.includes("왜") || lower.includes("이유")) {
    return "→ 무작위 균등 추첨 결과, 특별한 원인 없음";
  }

  return "→ 확률 결론만 요약됨 (AI 한도 초과 시)";
}

export function isQuotaError(message) {
  const text = String(message).toLowerCase();
  return (
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("rate-limit") ||
    text.includes("resource_exhausted") ||
    text.includes("too many requests")
  );
}

export function parseRetrySeconds(message) {
  const match = String(message).match(/retry in ([\d.]+)s/i);
  if (!match) return 3;
  return Math.min(Math.ceil(Number(match[1])), 60);
}
