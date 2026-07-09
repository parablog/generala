// Pure game logic — Argentine Generala.
export const CATS = [
  { id: 'u1', label: 'Unos', face: 1 },
  { id: 'u2', label: 'Doses', face: 2 },
  { id: 'u3', label: 'Treses', face: 3 },
  { id: 'u4', label: 'Cuatros', face: 4 },
  { id: 'u5', label: 'Cincos', face: 5 },
  { id: 'u6', label: 'Seises', face: 6 },
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
})

export const total = (sc) => Object.values(sc).reduce((a, e) => a + e.pts, 0)

export const filled = (sc) => Object.keys(sc).length

// Turn order: everyone fills one category per round, so the first player
// with the fewest filled cells is up.
export const currentPlayer = (g) => {
  const counts = g.scores.map(filled)
  return counts.indexOf(Math.min(...counts))
}

export const dobleUnlocked = (sc) => !!sc.generala && !sc.generala.tachado

export const isOver = (g) =>
  g.servidaWinner !== null || g.scores.every((s) => filled(s) === CATS.length)

export const winner = (g) =>
  g.servidaWinner ??
  g.scores.map(total).reduce((best, t, i, arr) => (t > arr[best] ? i : best), 0)

export const applyScore = (g, pIdx, catId, entry) => ({
  ...g,
  scores: g.scores.map((s, i) => (i === pIdx ? { ...s, [catId]: entry } : s)),
  servidaWinner:
    catId === 'generala' && entry.servida && !entry.tachado ? pIdx : g.servidaWinner,
})
