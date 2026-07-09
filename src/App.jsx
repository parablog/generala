import { useEffect, useState } from 'react'
import {
  CATS, newGame, total, filled, currentPlayer, dobleUnlocked, isOver, winner, applyScore,
} from './game'

const load = (k) => JSON.parse(localStorage.getItem(k) ?? 'null')
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))

const btn = 'rounded-xl px-4 py-3 font-semibold active:scale-95 transition'
const primary = `${btn} bg-amber-500 text-white shadow`
const secondary = `${btn} bg-stone-200 text-stone-800 dark:bg-slate-700 dark:text-slate-100`

export default function App() {
  const [dark, setDark] = useState(
    () => load('generala-dark') ?? matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [screen, setScreen] = useState('home')
  const [game, setGame] = useState(() => load('generala-game'))
  const [undo, setUndo] = useState(null) // ponytail: single-level undo, per spec
  const [cell, setCell] = useState(null) // { pIdx, cat } being scored

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    save('generala-dark', dark)
  }, [dark])

  const startGame = (names) => {
    const g = newGame(names)
    setGame(g)
    setUndo(null)
    save('generala-game', g)
    setScreen('game')
  }

  const score = (entry) => {
    const g = applyScore(game, cell.pIdx, cell.cat.id, entry)
    setUndo(game)
    setGame(g)
    setCell(null)
    if (isOver(g)) {
      setUndo(null)
      localStorage.removeItem('generala-game')
      save('generala-history', [
        {
          date: Date.now(),
          servida: g.servidaWinner !== null,
          winner: g.players[winner(g)],
          players: g.players.map((name, i) => ({
            name,
            total: total(g.scores[i]),
            generala: !!g.scores[i].generala && !g.scores[i].generala.tachado,
          })),
        },
        ...(load('generala-history') ?? []),
      ])
      setScreen('over')
    } else {
      save('generala-game', g)
    }
  }

  const doUndo = () => {
    setGame(undo)
    save('generala-game', undo)
    setUndo(null)
  }

  const props = { game, setScreen, startGame, dark, setDark, undo, doUndo, cell, setCell, score }
  return (
    <div className="min-h-dvh bg-paper text-stone-800 dark:bg-slate-900 dark:text-slate-100">
      {screen === 'home' && <Home {...props} />}
      {screen === 'setup' && <Setup {...props} />}
      {screen === 'game' && <Game {...props} />}
      {screen === 'over' && <Over {...props} />}
      {screen === 'history' && <History {...props} />}
    </div>
  )
}

const DarkToggle = ({ dark, setDark }) => (
  <button className="text-2xl" onClick={() => setDark(!dark)} aria-label="Modo oscuro">
    {dark ? '☀️' : '🌙'}
  </button>
)

function Home({ game, setScreen, dark, setDark }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
      <div className="absolute top-4 right-4"><DarkToggle dark={dark} setDark={setDark} /></div>
      <div className="text-7xl">🎲</div>
      <h1 className="mb-6 text-5xl font-bold tracking-tight">Generala</h1>
      <button className={`${primary} w-64 text-lg`} onClick={() => setScreen('setup')}>
        Nueva Partida
      </button>
      {game && !isOver(game) && (
        <button className={`${secondary} w-64 text-lg`} onClick={() => setScreen('game')}>
          Continuar Partida
        </button>
      )}
      <button className={`${secondary} w-64 text-lg`} onClick={() => setScreen('history')}>
        Historial
      </button>
    </div>
  )
}

function Setup({ setScreen, startGame }) {
  const [names, setNames] = useState([])
  const [draft, setDraft] = useState('')
  const add = () => {
    const n = draft.trim()
    if (n && names.length < 8) {
      setNames([...names, n])
      setDraft('')
    }
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold">Jugadores</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); add() }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800"
          placeholder="Nombre"
          enterKeyHint="done"
          autoCapitalize="words"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <button type="submit" className={primary} disabled={names.length >= 8}>+</button>
      </form>
      <ul className="flex flex-col gap-2">
        {names.map((n, i) => (
          <li key={i} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
            <span className="font-medium">{i + 1}. {n}</span>
            <button
              className="text-stone-400"
              onClick={() => setNames(names.filter((_, j) => j !== i))}
              aria-label={`Quitar ${n}`}
            >✕</button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-stone-500 dark:text-slate-400">De 2 a 8 jugadores</p>
      <button className={`${primary} text-lg disabled:opacity-40`} disabled={names.length < 2} onClick={() => startGame(names)}>
        Empezar
      </button>
      <button className={secondary} onClick={() => setScreen('home')}>Volver</button>
    </div>
  )
}

function Game({ game, setScreen, dark, setDark, undo, doUndo, cell, setCell, score }) {
  const cur = currentPlayer(game)
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button className="text-xl" onClick={() => setScreen('home')} aria-label="Inicio">🏠</button>
        <span className="font-bold">
          Turno: <span className="text-amber-600 dark:text-amber-400">{game.players[cur]}</span>
        </span>
        <div className="flex items-center gap-4">
          {undo && <button className="text-xl" onClick={doUndo} aria-label="Deshacer">↩️</button>}
          <DarkToggle dark={dark} setDark={setDark} />
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {/* border-separate: sticky + border-collapse breaks on iOS Safari */}
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-paper p-2 text-left dark:bg-slate-900" />
              {game.players.map((p, i) => (
                <th
                  key={i}
                  className={`sticky top-0 z-10 min-w-16 p-2 font-bold ${i === cur ? 'rounded-t-lg bg-amber-500 text-white' : 'bg-paper dark:bg-slate-900'}`}
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATS.map((cat) => (
              <tr key={cat.id}>
                <td className="sticky left-0 z-10 border-t border-stone-200 bg-paper px-2 py-3 font-medium whitespace-nowrap dark:border-slate-700 dark:bg-slate-900">
                  {cat.label}
                </td>
                {game.players.map((_, i) => {
                  const e = game.scores[i][cat.id]
                  const locked = cat.id === 'doble' && !dobleUnlocked(game.scores[i])
                  const tappable = !e && i === cur && !locked
                  return (
                    <td
                      key={i}
                      className={`border-t border-stone-200 px-2 py-3 text-center dark:border-slate-700 ${i === cur ? 'bg-amber-100 dark:bg-amber-500/10' : ''} ${locked ? 'opacity-30' : ''}`}
                      onClick={() => tappable && setCell({ pIdx: i, cat })}
                    >
                      {e ? (
                        e.tachado ? (
                          <span className="text-stone-400 line-through">0</span>
                        ) : (
                          <span className="font-semibold">
                            {e.pts}
                            {e.servida && <span className="text-amber-500"> ★</span>}
                          </span>
                        )
                      ) : locked ? '🔒' : tappable ? (
                        <span className="text-stone-300 dark:text-slate-600">·</span>
                      ) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="sticky bottom-0 left-0 z-20 border-t-2 border-stone-400 bg-paper p-2 font-bold dark:border-slate-500 dark:bg-slate-900">
                Total
              </td>
              {game.scores.map((s, i) => (
                <td
                  key={i}
                  className="sticky bottom-0 z-10 border-t-2 border-stone-400 bg-paper p-2 text-center text-base font-bold dark:border-slate-500 dark:bg-slate-900"
                >
                  {total(s)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {cell && <ScoreSheet cell={cell} onClose={() => setCell(null)} onScore={score} playerName={game.players[cell.pIdx]} />}
    </div>
  )
}

function ScoreSheet({ cell, onClose, onScore, playerName }) {
  const [pending, setPending] = useState(null)
  const { cat } = cell
  const opt = (label, entry, key) => (
    <button
      key={key ?? label}
      className={`${btn} ${JSON.stringify(pending) === JSON.stringify(entry)
        ? 'bg-amber-500 text-white'
        : 'bg-stone-100 dark:bg-slate-700'}`}
      onClick={() => setPending(entry)}
    >
      {label}
    </button>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">
          {playerName} — {cat.label}
        </h3>
        <div className={`mb-4 grid gap-2 ${cat.face ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {cat.face
            ? [0, 1, 2, 3, 4, 5].map((n) =>
                opt(`${n * cat.face}`, { pts: n * cat.face }, n))
            : cat.servidaGana
              ? [opt('Generala (50)', { pts: 50 }), opt('¡Servida! — Gana el juego 🏆', { pts: 50, servida: true })]
              : cat.servida
                ? [opt(`Normal (${cat.pts})`, { pts: cat.pts }), opt(`Servida (${cat.servida}) ★`, { pts: cat.servida, servida: true })]
                : [opt(`${cat.label} (${cat.pts})`, { pts: cat.pts })]}
          {opt('Tachar ✗', { pts: 0, tachado: true })}
        </div>
        <div className="flex gap-2">
          <button className={`${secondary} flex-1`} onClick={onClose}>Cancelar</button>
          <button
            className={`${primary} flex-1 disabled:opacity-40`}
            disabled={!pending}
            onClick={() => onScore(pending)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function Over({ game, setScreen }) {
  const w = winner(game)
  const servida = game.servidaWinner !== null
  const ranked = game.players
    .map((name, i) => ({ name, total: total(game.scores[i]), i }))
    .sort((a, b) => (a.i === w ? -1 : b.i === w ? 1 : b.total - a.total))
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8">
      <div className={`text-7xl ${servida ? 'animate-party' : ''}`}>{servida ? '🎲' : '🏆'}</div>
      {servida && (
        <p className="text-center text-2xl font-bold text-amber-600 dark:text-amber-400">
          ¡GENERALA SERVIDA!
        </p>
      )}
      <h2 className="text-3xl font-bold">Ganó {game.players[w]}</h2>
      {servida && <p className="text-stone-500 dark:text-slate-400">El héroe de la mesa 🫡</p>}
      <ol className="w-full">
        {ranked.map((p, pos) => (
          <li
            key={p.i}
            className={`mt-2 flex justify-between rounded-xl px-4 py-3 ${p.i === w ? 'bg-amber-500 font-bold text-white' : 'bg-white dark:bg-slate-800'}`}
          >
            <span>{pos + 1}. {p.name}</span>
            <span>{p.total}</span>
          </li>
        ))}
      </ol>
      <button className={`${primary} w-full text-lg`} onClick={() => setScreen('setup')}>Nueva Partida</button>
      <button className={`${secondary} w-full`} onClick={() => setScreen('home')}>Volver al Inicio</button>
    </div>
  )
}

function History({ setScreen }) {
  const games = load('generala-history') ?? []
  const stats = {}
  for (const g of games) {
    for (const p of g.players) {
      const s = (stats[p.name] ??= { games: 0, wins: 0, points: 0, generalas: 0 })
      s.games++
      s.points += p.total
      if (p.generala) s.generalas++
      if (p.name === g.winner) s.wins++
    }
  }
  const board = Object.entries(stats).sort((a, b) => b[1].wins - a[1].wins)
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold">Historial</h2>
      {games.length === 0 && <p className="text-stone-500 dark:text-slate-400">Todavía no hay partidas.</p>}
      {board.length > 0 && (
        <table className="w-full rounded-xl bg-white text-sm shadow-sm dark:bg-slate-800">
          <thead>
            <tr className="text-left text-stone-500 dark:text-slate-400">
              <th className="p-3">Jugador</th>
              <th className="p-3 text-center">Victorias</th>
              <th className="p-3 text-center">Promedio</th>
              <th className="p-3 text-center">Generalas</th>
            </tr>
          </thead>
          <tbody>
            {board.map(([name, s]) => (
              <tr key={name} className="border-t border-stone-100 dark:border-slate-700">
                <td className="p-3 font-medium">{name}</td>
                <td className="p-3 text-center">{s.wins}</td>
                <td className="p-3 text-center">{Math.round(s.points / s.games)}</td>
                <td className="p-3 text-center">{s.generalas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="flex flex-col gap-2">
        {games.map((g, i) => (
          <li key={i} className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex justify-between text-sm text-stone-500 dark:text-slate-400">
              <span>{new Date(g.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {g.servida && <span className="font-bold text-amber-500">★ SERVIDA</span>}
            </div>
            <div className="mt-1 font-bold">🏆 {g.winner}</div>
            <div className="text-sm">{g.players.map((p) => `${p.name} ${p.total}`).join(' · ')}</div>
          </li>
        ))}
      </ul>
      <button className={secondary} onClick={() => setScreen('home')}>Volver</button>
    </div>
  )
}
