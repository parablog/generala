import assert from 'node:assert'
import {
  CATS,
  newGame,
  total,
  currentPlayer,
  dobleUnlocked,
  endGame,
  isOver,
  winner,
  winners,
  applyScore,
  skipTurn,
} from './game.js'

let g = newGame(['Ana', 'Beto'])

// turn order: Ana first, then Beto, then Ana again
assert.equal(currentPlayer(g), 0)
g = applyScore(g, 0, 'u5', { pts: 15 }) // three 5s
assert.equal(currentPlayer(g), 1)
g = applyScore(g, 1, 'escalera', { pts: 25, servida: true })
assert.equal(currentPlayer(g), 0)
assert.equal(total(g.scores[1]), 25)

// tachar scores 0
g = applyScore(g, 0, 'poker', { pts: 0, tachado: true })
assert.equal(total(g.scores[0]), 15)

// doble locked until generala scored (not tachada)
assert.equal(dobleUnlocked(g.scores[1]), false)
g = applyScore(g, 1, 'generala', { pts: 50 })
assert.equal(dobleUnlocked(g.scores[1]), true)
assert.equal(g.servidaWinner, null)
g = applyScore(g, 0, 'generala', { pts: 0, tachado: true })
assert.equal(dobleUnlocked(g.scores[0]), false)

// generala servida = instant win regardless of totals
let h = newGame(['Ana', 'Beto'])
h = applyScore(h, 0, 'u6', { pts: 30 })
h = applyScore(h, 1, 'generala', { pts: 50, servida: true })
assert.equal(h.servidaWinner, 1)
assert.ok(isOver(h))
assert.equal(winner(h), 1)

// doble servida (after a scored generala) = instant win too
let ds = newGame(['Ana', 'Beto'])
ds = applyScore(ds, 0, 'generala', { pts: 50 })
ds = applyScore(ds, 1, 'u1', { pts: 3 })
ds = applyScore(ds, 0, 'doble', { pts: 100, servida: true })
assert.equal(ds.servidaWinner, 0)
assert.ok(isOver(ds))
assert.equal(winner(ds), 0)

// normal end: all cells filled, highest total wins
let f = newGame(['Ana', 'Beto'])
for (const c of CATS) {
  f = applyScore(f, 0, c.id, { pts: c.face ?? c.pts })
  f = applyScore(f, 1, c.id, { pts: 0, tachado: true })
}
assert.ok(isOver(f))
assert.equal(winner(f), 0)
assert.deepEqual(winners(f), [0])

// a tied card does not silently award the first player
let tied = newGame(['Ana', 'Beto'])
for (const c of CATS) {
  tied = applyScore(tied, 0, c.id, { pts: 0, tachado: true })
  tied = applyScore(tied, 1, c.id, { pts: 0, tachado: true })
}
assert.deepEqual(winners(tied), [0, 1])

// skip turn: passes to the next player without scoring
let s = newGame(['Ana', 'Beto', 'Caro'])
s = skipTurn(s)
assert.equal(currentPlayer(s), 1)
s = applyScore(s, 1, 'u1', { pts: 2 })
assert.equal(currentPlayer(s), 2)
s = skipTurn(s)
assert.equal(currentPlayer(s), 0) // wraps around

// players with a full card are skipped automatically
let d = newGame(['Ana', 'Beto'])
d = {
  ...d,
  scores: [Object.fromEntries(CATS.map((c) => [c.id, { pts: 0, tachado: true }])), {}],
  turn: 1,
}
assert.equal(currentPlayer(d), 1)
d = applyScore(d, 1, 'u1', { pts: 1 })
assert.equal(currentPlayer(d), 1) // Ana is full, stays on Beto

// old saves without a turn pointer still resolve a current player
assert.equal(currentPlayer({ players: ['A', 'B'], scores: [{ u1: { pts: 1 } }, {}] }), 1)

// invalid state transitions are rejected at the game boundary
const guarded = newGame(['Ana', 'Beto'])
assert.throws(() => applyScore(guarded, 1, 'u1', { pts: 1 }), /turno/)
assert.throws(() => applyScore(guarded, 0, 'u1', { pts: 6 }), /inválido/)
assert.throws(() => applyScore(guarded, 0, 'doble', { pts: 100 }), /Generala previa/)
assert.throws(() => applyScore(guarded, 0, 'inventada', { pts: 10 }), /desconocida/)

const firstScore = applyScore(guarded, 0, 'u1', { pts: 2 })
assert.throws(() => applyScore(firstScore, 1, 'u1', { pts: 1, servida: true }), /inválido/)

const complete = {
  ...guarded,
  scores: guarded.scores.map(() => Object.fromEntries(CATS.map((c) => [c.id, { pts: 0, tachado: true }]))),
}
assert.throws(() => applyScore(complete, 0, 'u1', { pts: 1 }), /terminó/)

// a game can be closed early and keeps the scores entered so far
const endedEarly = endGame(firstScore)
assert.ok(isOver(endedEarly))
assert.equal(total(endedEarly.scores[0]), 2)
assert.deepEqual(winners(endedEarly), [0])
assert.throws(() => applyScore(endedEarly, 1, 'u2', { pts: 2 }), /terminó/)

console.log('ok')
