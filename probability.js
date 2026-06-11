const MAIN_PICK = 6;
const MAX_NUMBER = 45;
const BONUS_POOL = MAX_NUMBER - MAIN_PICK;

function combination(n, r) {
  if (r < 0 || r > n) return 0;
  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

export const MAIN_COMBINATIONS = combination(MAX_NUMBER, MAIN_PICK);
export const FULL_SET_COMBINATIONS = MAIN_COMBINATIONS * BONUS_POOL;

export function getDrawProbabilityStats(sets) {
  const singleSetProbability = 1 / FULL_SET_COMBINATIONS;
  const anyMainNumberProbability = MAIN_PICK / MAX_NUMBER;
  const anyBonusProbability = 1 / BONUS_POOL;

  return {
    rules: {
      poolSize: MAX_NUMBER,
      mainPick: MAIN_PICK,
      bonusPick: 1,
      drawMethod: "중복 없는 무작위 추출 (균등 확률)",
    },
    combinations: {
      main: MAIN_COMBINATIONS,
      fullSet: FULL_SET_COMBINATIONS,
    },
    probabilities: {
      exactSet: singleSetProbability,
      exactSetPercent: (singleSetProbability * 100).toExponential(4),
      exactSetOdds: `1 : ${FULL_SET_COMBINATIONS.toLocaleString("ko-KR")}`,
      numberInMain: anyMainNumberProbability,
      numberInMainPercent: ((anyMainNumberProbability) * 100).toFixed(2) + "%",
      exactBonus: anyBonusProbability,
      exactBonusPercent: ((anyBonusProbability) * 100).toFixed(2) + "%",
      multiSet: {
        setCount: sets.length,
        atLeastOneExactSet:
          1 - (1 - singleSetProbability) ** sets.length,
      },
    },
    sets: sets.map((set, index) => ({
      setIndex: index + 1,
      main: [...set.main].sort((a, b) => a - b),
      bonus: set.bonus,
      exactSetProbability: singleSetProbability,
      exactSetOdds: `1/${FULL_SET_COMBINATIONS.toLocaleString("ko-KR")}`,
    })),
  };
}
