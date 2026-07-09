import assert from 'node:assert'
import { CATS, newGame, total, currentPlayer, dobleUnlocked, isOver, winner, applyScore } from './game.js'

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

// normal end: all cells filled, highest total wins
let f = newGame(['Ana', 'Beto'])
for (const c of CATS) {
  f = applyScore(f, 0, c.id, { pts: 10 })
  f = applyScore(f, 1, c.id, { pts: 5 })
}
assert.ok(isOver(f))
assert.equal(winner(f), 0)

console.log('ok')
