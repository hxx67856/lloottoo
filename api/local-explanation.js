export function buildLocalExplanation(stats) {
  const setLines = stats.sets.map((set) => {
    const nums = set.main.join(", ");
    return `· 세트${set.setIndex} [${nums}] +${set.bonus} → ${set.exactSetOdds}`;
  });

  const lines = [
    ...setLines,
    `· 번호 1개 포함: ${stats.probabilities.numberInMainPercent}`,
    `· 보너스 특정 번호: ${stats.probabilities.exactBonusPercent}`,
  ];

  if (stats.sets.length > 1) {
    lines.push(
      `· ${stats.sets.length}세트 중 1개 일치: ${(
        stats.probabilities.multiSet.atLeastOneExactSet * 100
      ).toFixed(4)}%`,
    );
  }

  return lines.join("\n");
}

export function buildLocalFollowUpReply(message, stats) {
  const text = message.trim();
  const lower = text.toLowerCase();
  const numbers = [...text.matchAll(/\b([1-9]|[1-3][0-9]|4[0-5])\b/g)].map(
    (match) => Number(match[1]),
  );

  if (numbers.length > 0) {
    const n = numbers[0];
    const inMain = stats.sets.some((set) => set.main.includes(n));
    const isBonus = stats.sets.some((set) => set.bonus === n);
    const mainPct = ((6 / 45) * 100).toFixed(2);
    const bonusPct = ((1 / 39) * 100).toFixed(2);

    if (lower.includes("보너스")) {
      return `· ${n}번 보너스 확률: ${bonusPct}% (이번 추첨 ${isBonus ? "포함" : "미포함"})`;
    }

    return `· ${n}번 메인 포함 확률: ${mainPct}% (이번 추첨 ${inMain ? "포함" : "미포함"})`;
  }

  if (/몇\s*분의\s*1|odds|일치/.test(lower)) {
    return `· 정확 일치: ${stats.probabilities.exactSetOdds}`;
  }

  if (/보너스/.test(lower)) {
    return `· 보너스 특정 번호: ${stats.probabilities.exactBonusPercent}`;
  }

  if (/왜|이유|나왔/.test(lower)) {
    return "· 무작위 균등 추첨 결과, 특정 번호에 유리한 이유 없음";
  }

  if (/확률|당첨|가능/.test(lower)) {
    return `· 정확 일치 ${stats.probabilities.exactSetOdds}, 번호 1개 포함 ${stats.probabilities.numberInMainPercent}`;
  }

  if (/세트|조합|여러/.test(lower)) {
    if (stats.sets.length > 1) {
      return `· ${stats.sets.length}세트 중 1개 일치: ${(
        stats.probabilities.multiSet.atLeastOneExactSet * 100
      ).toFixed(4)}%`;
    }
    return `· 1세트 기준 정확 일치: ${stats.probabilities.exactSetOdds}`;
  }

  return `· 질문 요약: 무작위 추첨이므로 정확 일치 ${stats.probabilities.exactSetOdds}`;
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
