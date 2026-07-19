export function resolveCombat(score, winThreshold = 55) {
  const won = score.total >= winThreshold;
  const damage = won
    ? Math.min(80, 20 + Math.round((score.total - winThreshold) * 1.2))
    : Math.min(65, 20 + winThreshold - score.total);

  return Object.freeze({
    won,
    damage,
    playerHealth: won ? 100 : 100 - damage,
    opponentHealth: won ? 100 - damage : 100,
    verdict: won
      ? `ROUND WON — ${damage} damage`
      : `ROUND LOST — ${damage} damage taken`
  });
}
