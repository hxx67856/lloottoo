export function buildLocalExplanation(stats, message = "") {
  const lines = stats.sets.map((set) => {
    const main = set.main.join(", ");
    return `세트 ${set.setIndex}: ${main} · 보너스 ${set.bonus}`;
  });

  const base = [
    "이번 번호는 1~45에서 중복 없이, 모든 조합이 같은 확률로 무작위 추첨된 결과입니다.",
    "특정 번호가 더 잘 나오도록 설계된 것이 아니며, 이번 결과도 그중 하나가 선택된 것입니다.",
    "",
    "추첨 결과",
    ...lines,
    "",
    "확률 요약",
    `· 이 조합(6개+보너스)이 그대로 나올 확률: ${stats.probabilities.exactSetOdds}`,
    `· 특정 번호 1개가 메인 6개에 들어갈 확률: ${stats.probabilities.numberInMainPercent}`,
    `· 보너스 번호가 특정 숫자일 확률: ${stats.probabilities.exactBonusPercent}`,
  ];

  if (stats.sets.length > 1) {
    base.push(
      `· ${stats.sets.length}세트 중 하나라도 이 조합이 나올 확률: ${(
        stats.probabilities.multiSet.atLeastOneExactSet * 100
      ).toFixed(6)}%`,
    );
  }

  base.push(
    "",
    "※ 본 추첨기는 오락용이며, 당첨을 보장하지 않습니다.",
  );

  if (message.trim()) {
    base.push("", buildLocalFollowUp(message.trim(), stats));
  }

  return base.join("\n");
}

function buildLocalFollowUp(message, stats) {
  const lower = message.toLowerCase();

  if (lower.includes("확률") || lower.includes("당첨")) {
    return `질문에 대한 요약: 이 조합의 정확한 일치 확률은 ${stats.probabilities.exactSetOdds}입니다. 로또는 무작위 게임이므로 이전 결과가 다음 결과에 영향을 주지 않습니다.`;
  }

  if (lower.includes("왜") || lower.includes("이유")) {
    return "질문에 대한 요약: 각 번호는 추첨 시점에 동일한 확률로 선택됩니다. '왜 이 번호인가'에 대한 특별한 원인은 없고, 무작위 추출의 결과입니다.";
  }

  return "질문에 대한 요약: 현재 Gemini API 무료 사용 한도에 도달해 AI 상세 답변 대신 확률 통계 기반 기본 설명을 제공합니다. 잠시 후 다시 시도해 주세요.";
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
