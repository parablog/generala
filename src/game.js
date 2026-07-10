// Pure game logic — Argentine Generala.
export const CATS = [
  { id: 'u1', label: '1', face: 1 },
  { id: 'u2', label: '2', face: 2 },
  { id: 'u3', label: '3', face: 3 },
  { id: 'u4', label: '4', face: 4 },
  { id: 'u5', label: '5', face: 5 },
  { id: 'u6', label: '6', face: 6 },
  { id: 'escalera', label: 'Escalera', pts: 20, servida: 25 },
  { id: 'full', label: 'Full', pts: 30, servida: 35 },
  { id: 'poker', label: 'Póker', pts: 40, servida: 45 },
  { id: 'generala', label: 'Generala', pts: 50, servidaGana: true },
  { id: 'doble', label: 'G. Doble', pts: 100 },
]

// scores: one object per player, catId -> { pts, servida?, tachado? }
export const newGame = (players) => ({
  players,
  scores: players.map(() => ({})),
  servidaWinner: null,
  turn: 0,
})

export const total = (sc) => Object.values(sc).reduce((a, e) => a + e.pts, 0)

export const filled = (sc) => Object.keys(sc).length

// Explicit turn pointer (skips make it non-derivable). The filled-count
// fallback covers games saved before `turn` existed.
export const currentPlayer = (g) => {
  if (g.turn != null) return g.turn
  const counts = g.scores.map(filled)
  return counts.indexOf(Math.min(...counts))
}

// Next player after `from` who still has empty categories.
const nextTurn = (g, from) => {
  for (let k = 1; k <= g.players.length; k++) {
    const i = (from + k) % g.players.length
    if (filled(g.scores[i]) < CATS.length) return i
  }
  return from
}

export const skipTurn = (g) => ({ ...g, turn: nextTurn(g, currentPlayer(g)) })

export const dobleUnlocked = (sc) => !!sc.generala && !sc.generala.tachado

export const isOver = (g) =>
  g.servidaWinner !== null || g.scores.every((s) => filled(s) === CATS.length)

export const winner = (g) =>
  g.servidaWinner ??
  g.scores.map(total).reduce((best, t, i, arr) => (t > arr[best] ? i : best), 0)

export const applyScore = (g, pIdx, catId, entry) => {
  const g2 = {
    ...g,
    scores: g.scores.map((s, i) => (i === pIdx ? { ...s, [catId]: entry } : s)),
    servidaWinner:
      catId === 'generala' && entry.servida && !entry.tachado ? pIdx : g.servidaWinner,
  }
  return { ...g2, turn: nextTurn(g2, pIdx) }
}
