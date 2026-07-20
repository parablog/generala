import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  Crown,
  Eye,
  EyeOff,
  History as HistoryIcon,
  Home as HomeIcon,
  Moon,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Trophy,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import {
  CATS,
  applyScore,
  currentPlayer,
  dobleUnlocked,
  endGame,
  isOver,
  newGame,
  skipTurn,
  total,
  winners,
} from './game'
import {
  fetchRemoteHistory,
  planSync,
  readRemoteConfig,
  removeRemoteConfig,
  saveRemoteConfig,
  saveRemoteDeletion,
  saveRemoteHistoryEntry,
  testRemoteConnection,
} from './remote'

const STORAGE = Object.freeze({
  dark: 'generala-dark',
  game: 'generala-game',
  history: 'generala-history',
  deleted: 'generala-deleted',
})

const SCREEN_ROUTES = Object.freeze({
  home: '',
  setup: 'nueva',
  game: 'partida',
  over: 'resultado',
  history: 'historial',
  rules: 'reglas',
  settings: 'ajustes',
})

const ROUTE_SCREENS = Object.fromEntries(
  Object.entries(SCREEN_ROUTES).map(([screen, route]) => [route, screen]),
)

const load = (key, fallback = null) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

const save = (key, value) => localStorage.setItem(key, JSON.stringify(value))

const ensureHistoryIds = (games) => games.map((game) => (
  game.id ? game : { ...game, id: crypto.randomUUID() }
))

const isStoredGame = (game) =>
  Array.isArray(game?.players) &&
  game.players.length >= 2 &&
  game.players.every((name) => typeof name === 'string') &&
  Array.isArray(game?.scores) &&
  game.scores.length === game.players.length

const screenFromLocation = (game) => {
  const route = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '')
  const requested = ROUTE_SCREENS[route] ?? 'home'
  if (requested === 'game' && (!game || isOver(game))) return 'home'
  if (requested === 'over' && (!game || !isOver(game))) return 'home'
  return requested
}

const buttonBase = 'button-base'
const primary = `${buttonBase} button-primary`
const secondary = `${buttonBase} button-secondary`

export default function App() {
  const [dark, setDark] = useState(
    () => load(STORAGE.dark) ?? window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [game, setGame] = useState(() => {
    const stored = load(STORAGE.game)
    return isStoredGame(stored) ? stored : null
  })
  const [screen, setScreenState] = useState(() => screenFromLocation(game))
  const [undo, setUndo] = useState([])
  const [redo, setRedo] = useState([])
  const [cell, setCell] = useState(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  const setScreen = (nextScreen, { replace = false } = {}) => {
    setScreenState(nextScreen)
    const hash = `#/${SCREEN_ROUTES[nextScreen]}`
    if (window.location.hash === hash) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', hash)
  }

  const syncRemoteHistory = async (providedConfig = readRemoteConfig()) => {
    if (!providedConfig?.enabled) return load(STORAGE.history, [])

    const localGames = ensureHistoryIds(load(STORAGE.history, []))
    save(STORAGE.history, localGames)
    const remoteGames = await fetchRemoteHistory(providedConfig)
    const { toUpload, toDelete, deletedIds, merged } = planSync(localGames, remoteGames, load(STORAGE.deleted, []))
    await Promise.all([
      ...toUpload.map((entry) => saveRemoteHistoryEntry(providedConfig, entry)),
      ...toDelete.map((id) => saveRemoteDeletion(providedConfig, id)),
    ])

    save(STORAGE.history, merged)
    save(STORAGE.deleted, deletedIds)
    setHistoryVersion((version) => version + 1)
    return merged
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    save(STORAGE.dark, dark)
  }, [dark])

  useEffect(() => {
    const handleRouteChange = () => setScreenState(screenFromLocation(game))
    window.addEventListener('hashchange', handleRouteChange)
    window.addEventListener('popstate', handleRouteChange)
    return () => {
      window.removeEventListener('hashchange', handleRouteChange)
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [game])

  useEffect(() => {
    syncRemoteHistory().catch(() => {})

    const syncWhenActive = () => {
      if (document.visibilityState === 'visible') syncRemoteHistory().catch(() => {})
    }
    window.addEventListener('online', syncWhenActive)
    window.addEventListener('focus', syncWhenActive)
    document.addEventListener('visibilitychange', syncWhenActive)
    return () => {
      window.removeEventListener('online', syncWhenActive)
      window.removeEventListener('focus', syncWhenActive)
      document.removeEventListener('visibilitychange', syncWhenActive)
    }
  }, [])

  const startGame = (entries) => {
    // Game displays nicknames; `names` keeps the real identities for history/stats.
    const nextGame = {
      ...newGame(entries.map(({ nick, name }) => nick || name)),
      names: entries.map(({ name }) => name),
    }
    setGame(nextGame)
    setUndo([])
    setRedo([])
    save(STORAGE.game, nextGame)
    setScreen('game')
  }

  const finishGame = (finishedGame) => {
    setGame(finishedGame)
    setUndo([])
    setRedo([])
    setCell(null)
    localStorage.removeItem(STORAGE.game)

    const realNames = finishedGame.names ?? finishedGame.players
    const winnerNames = winners(finishedGame).map((index) => realNames[index])
    const historyEntry = {
      id: crypto.randomUUID(),
      date: Date.now(),
      endedEarly: finishedGame.ended === true,
      servida: finishedGame.servidaWinner !== null,
      winner: winnerNames.join(' y '),
      winners: winnerNames,
      players: finishedGame.players.map((name, index) => ({
        name: realNames[index],
        total: total(finishedGame.scores[index]),
        generala: Boolean(finishedGame.scores[index].generala && !finishedGame.scores[index].generala.tachado),
      })),
    }
    save(STORAGE.history, [historyEntry, ...load(STORAGE.history, [])])
    setHistoryVersion((version) => version + 1)
    const remoteConfig = readRemoteConfig()
    if (remoteConfig?.enabled) saveRemoteHistoryEntry(remoteConfig, historyEntry).catch(() => {})
    setScreen('over')
  }

  const score = (entry) => {
    if (!cell) return

    const nextGame = applyScore(game, cell.pIdx, cell.cat.id, entry)
    setUndo((states) => [...states, game])
    setRedo([])
    setGame(nextGame)
    setCell(null)

    if (!isOver(nextGame)) {
      save(STORAGE.game, nextGame)
      return
    }

    finishGame(nextGame)
  }

  const abandon = () => {
    localStorage.removeItem(STORAGE.game)
    setGame(null)
    setUndo([])
    setRedo([])
    setCell(null)
    setScreen('home')
  }

  const finishEarly = () => finishGame(endGame(game))

  const doUndo = () => {
    const previous = undo.at(-1)
    if (!previous) return

    setGame(previous)
    save(STORAGE.game, previous)
    setUndo((states) => states.slice(0, -1))
    setRedo((states) => [...states, game])
    setCell(null)
  }

  const doRedo = () => {
    const next = redo.at(-1)
    if (!next) return

    setGame(next)
    save(STORAGE.game, next)
    setUndo((states) => [...states, game])
    setRedo((states) => states.slice(0, -1))
    setCell(null)
  }

  const skip = () => {
    const nextGame = skipTurn(game)
    setUndo((states) => [...states, game])
    setRedo([])
    setGame(nextGame)
    save(STORAGE.game, nextGame)
  }

  const props = {
    game,
    setScreen,
    startGame,
    dark,
    setDark,
    undo,
    redo,
    doUndo,
    doRedo,
    cell,
    setCell,
    score,
    abandon,
    finishEarly,
    historyVersion,
    syncRemoteHistory,
    skip,
  }

  return (
    <div className="app-shell">
      {screen === 'home' && <Home {...props} />}
      {screen === 'setup' && <Setup {...props} />}
      {screen === 'game' && game && <Game {...props} />}
      {screen === 'over' && game && <Over {...props} />}
      {screen === 'history' && <History {...props} />}
      {screen === 'rules' && <Rules {...props} />}
      {screen === 'settings' && <Settings {...props} />}
    </div>
  )
}

const PIPS = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 7], [17, 7], [7, 12], [17, 12], [7, 17], [17, 17]],
}

const Die = ({ face, className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="5" className="fill-current" />
    {PIPS[face].map(([x, y], index) => (
      <circle key={index} cx={x} cy={y} r="2.15" className="fill-white dark:fill-[#101a22]" />
    ))}
  </svg>
)

const BrandMark = ({ compact = false }) => (
  <div className={compact ? 'brand-mark brand-mark-compact' : 'brand-mark'} aria-hidden="true">
    <span className="brand-sun"><Sun /></span>
    <span className="brand-die brand-die-one"><Die face={5} className="size-full" /></span>
    <span className="brand-die brand-die-two"><Die face={3} className="size-full" /></span>
  </div>
)

const Cross = () => (
  <span className="cross-mark" aria-label="Tachado">
    <X size={16} strokeWidth={3} />
  </span>
)

const CategoryMark = ({ cat }) => (
  cat.face
    ? <Die face={cat.face} />
    : <span className="category-initial">{cat.id === 'doble' ? 'D' : cat.label[0]}</span>
)

const IconButton = ({ label, children, className = '', ...props }) => (
  <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
    {children}
  </button>
)

const DarkToggle = ({ dark, setDark }) => (
  <IconButton label={dark ? 'Usar tema claro' : 'Usar tema oscuro'} onClick={() => setDark(!dark)}>
    {dark ? <Sun /> : <Moon />}
  </IconButton>
)

const ScreenHeader = ({ title, onBack, dark, setDark, action = null }) => (
  <header className="screen-header">
    <IconButton label="Volver" onClick={onBack}><ArrowLeft /></IconButton>
    <h1>{title}</h1>
    {action ?? <DarkToggle dark={dark} setDark={setDark} />}
  </header>
)

function Home({ game, setScreen, dark, setDark }) {
  const canContinue = game && !isOver(game)

  return (
    <main className="home-screen">
      <header className="home-header">
        <span className="country-label"><span className="flag-dot" /> Argentina</span>
        <DarkToggle dark={dark} setDark={setDark} />
      </header>

      <section className="home-hero">
        <div className="home-brand-copy">
          <p className="eyebrow">Anotador de mesa</p>
          <h1>Generala<br /><span>argentina</span></h1>
          <p className="home-subtitle">La planilla de siempre, lista para la próxima ronda.</p>
        </div>
        <BrandMark />
      </section>

      <nav className="home-actions" aria-label="Acciones principales">
        <button className={`${primary} home-primary`} onClick={() => setScreen('setup')}>
          <Plus /> Nueva partida <ChevronRight className="ml-auto" />
        </button>
        {canContinue ? (
          <button className={`${secondary} home-secondary`} onClick={() => setScreen('game')}>
            <RotateCcw /> Continuar partida
            <span className="action-meta">{game.players.length} jugadores</span>
          </button>
        ) : null}
        <div className="home-link-row">
          <button onClick={() => setScreen('history')}><HistoryIcon /> Historial</button>
          <button onClick={() => setScreen('rules')}><BookOpen /> Reglas</button>
          <button onClick={() => setScreen('settings')}><SettingsIcon /> Ajustes</button>
        </div>
      </nav>
    </main>
  )
}

function Setup({ setScreen, startGame, dark, setDark }) {
  const [players, setPlayers] = useState([])
  const [draft, setDraft] = useState('')
  const [nick, setNick] = useState('')
  const [error, setError] = useState('')
  const [showKnown, setShowKnown] = useState(false)

  const sameName = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0
  const known = [...new Set(load(STORAGE.history, []).flatMap((game) => game.players.map(({ name }) => name)))]
  const available = known.filter((name) => !players.some((current) => sameName(current.name, name)))
  const match = known.find((name) => sameName(name, draft.trim()))

  const add = () => {
    const name = match ?? draft.trim()
    if (!name || players.length >= 8) return
    if (players.some((current) => sameName(current.name, name))) {
      setError('Ese nombre ya está en la mesa.')
      return
    }

    setPlayers((current) => [...current, { name, nick: nick.trim() || name }])
    setDraft('')
    setNick('')
    setError('')
  }

  return (
    <main className="page-screen">
      <ScreenHeader title="Nueva partida" onBack={() => setScreen('home')} dark={dark} setDark={setDark} />
      <section className="page-content setup-content">
        <div className="section-heading">
          <span className="section-icon"><Users /></span>
          <div>
            <p className="eyebrow">Armá la mesa</p>
            <h2>¿Quiénes juegan?</h2>
          </div>
        </div>

        <form className="add-player" onSubmit={(event) => { event.preventDefault(); add() }}>
          <label htmlFor="player-name">Nombre del jugador</label>
          <div>
            <input
              id="player-name"
              placeholder="Ej. Martina"
              maxLength={20}
              enterKeyHint="done"
              autoCapitalize="words"
              autoComplete="off"
              value={draft}
              onChange={(event) => { setDraft(event.target.value); setError('') }}
              autoFocus
            />
            {available.length > 0 ? (
              <IconButton
                label="Elegir jugador existente"
                type="button"
                onClick={() => setShowKnown((visible) => !visible)}
              >
                <ChevronDown />
              </IconButton>
            ) : null}
            <IconButton label="Agregar jugador" type="submit" disabled={!draft.trim() || players.length >= 8}>
              <Plus />
            </IconButton>
          </div>
          {showKnown ? (
            <ul className="known-list">
              {available.map((name) => (
                <li key={name}>
                  <button type="button" onClick={() => { setDraft(name); setShowKnown(false); setError('') }}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {match ? (
            <div className="nick-row">
              <input
                id="player-nick"
                placeholder={`Apodo para ${match} (opcional)`}
                maxLength={20}
                enterKeyHint="done"
                autoCapitalize="words"
                autoComplete="off"
                value={nick}
                onChange={(event) => setNick(event.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>

        <div className="player-list-heading">
          <span>Orden de juego</span>
          <span>{players.length}/8</span>
        </div>
        <ol className="player-list">
          {players.map((player, index) => (
            <li key={player.name}>
              <span className="player-number">{index + 1}</span>
              <span>{player.nick !== player.name ? `${player.name} «${player.nick}»` : player.name}</span>
              <IconButton
                label={`Quitar a ${player.name}`}
                onClick={() => setPlayers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X />
              </IconButton>
            </li>
          ))}
          {players.length === 0 ? <li className="empty-player-list">Sumá entre 2 y 8 jugadores</li> : null}
        </ol>

        <button className={`${primary} start-button`} disabled={players.length < 2} onClick={() => startGame(players)}>
          Empezar partida <ChevronRight />
        </button>
      </section>
    </main>
  )
}

function Game({
  game,
  dark,
  setDark,
  undo,
  redo,
  doUndo,
  doRedo,
  cell,
  setCell,
  score,
  abandon,
  finishEarly,
  skip,
  setScreen,
}) {
  const current = currentPlayer(game)
  const [asking, setAsking] = useState(false)
  const [highlightedCell, setHighlightedCell] = useState(null)

  return (
    <main className="game-screen">
      <header className="game-header">
        <IconButton label="Salir de la partida" onClick={() => setAsking(true)}><HomeIcon /></IconButton>
        <div className="turn-label">
          <span>Turno de</span>
          <strong>{game.players[current]}</strong>
        </div>
        <div className="game-tools">
          <IconButton label="Ver reglas" onClick={() => setScreen('rules')}><CircleHelp /></IconButton>
          <IconButton label="Pasar turno" onClick={skip}><SkipForward /></IconButton>
          <IconButton label="Deshacer" onClick={doUndo} disabled={undo.length === 0}><Undo2 /></IconButton>
          <IconButton label="Rehacer" onClick={doRedo} disabled={redo.length === 0}><Redo2 /></IconButton>
          <DarkToggle dark={dark} setDark={setDark} />
        </div>
      </header>

      <div className="score-table-wrap">
        <table
          className={game.players.length <= 5 ? 'score-table score-table-fit' : 'score-table'}
        >
          <thead>
            <tr>
              <th className="category-head"><span>Juego</span></th>
              {game.players.map((player, index) => (
                <th key={index} className={index === current ? 'current-column player-head' : 'player-head'}>
                  <span>{player}</span>
                </th>
              ))}
              <th className="category-head category-head-right" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {CATS.map((cat) => (
              <tr key={cat.id}>
                <th scope="row" className="category-cell" aria-label={cat.label} title={cat.label}>
                  <CategoryMark cat={cat} />
                  <span>{cat.label}</span>
                </th>
                {game.players.map((_, playerIndex) => {
                  const entry = game.scores[playerIndex][cat.id]
                  const locked = cat.id === 'doble' && !dobleUnlocked(game.scores[playerIndex])
                  const tappable = !entry && playerIndex === current
                  const highlightKey = `${playerIndex}-${cat.id}`
                  const isHighlighted = highlightedCell === highlightKey
                  const label = entry
                    ? `${cat.label}: ${entry.tachado ? 'tachado' : `${entry.pts} puntos`}`
                    : `Anotar ${cat.label} para ${game.players[playerIndex]}`

                  return (
                    <td key={playerIndex} className={playerIndex === current ? 'current-column' : ''}>
                      {entry ? (
                        <span className="score-value" aria-label={label}>
                          {entry.tachado ? <Cross /> : entry.pts}
                          {entry.servida ? <Sun className="served-mark" aria-label="Servida" /> : null}
                        </span>
                      ) : tappable ? (
                        <button
                          className={locked ? 'score-button locked-score' : 'score-button'}
                          onClick={() => setCell({ pIdx: playerIndex, cat, locked })}
                          aria-label={label}
                        >
                          {locked ? <span aria-hidden="true">—</span> : <Plus aria-hidden="true" />}
                        </button>
                      ) : (
                        <button
                          className={isHighlighted ? 'missing-cell missing-cell-highlighted' : 'missing-cell'}
                          onClick={() => setHighlightedCell((selected) => selected === highlightKey ? null : highlightKey)}
                          aria-label={`${isHighlighted ? 'Quitar marca de' : 'Marcar'} ${cat.label} pendiente para ${game.players[playerIndex]}`}
                          aria-pressed={isHighlighted}
                        />
                      )}
                    </td>
                  )
                })}
                <th className="category-cell category-cell-right" title={cat.label} aria-hidden="true">
                  <CategoryMark cat={cat} />
                </th>
              </tr>
            ))}
            <tr className="total-row">
              <th scope="row">Total</th>
              {game.scores.map((scores, index) => <td key={index}>{total(scores)}</td>)}
              <th className="total-label-right" aria-hidden="true">Σ</th>
            </tr>
          </tbody>
        </table>
      </div>

      {cell ? (
        <ScoreSheet
          cell={cell}
          onClose={() => setCell(null)}
          onScore={score}
          playerName={game.players[cell.pIdx]}
        />
      ) : null}

      {asking ? (
        <Modal title="¿Salir de la partida?" onClose={() => setAsking(false)}>
          <p className="modal-copy">Podés cerrar la partida con los puntos actuales o eliminarla.</p>
          <button className={primary} onClick={finishEarly}><Trophy /> Terminar y guardar</button>
          <button className="button-base button-danger" onClick={abandon}>Salir y eliminar</button>
          <button className={secondary} onClick={() => setAsking(false)}>Seguir jugando</button>
        </Modal>
      ) : null}
    </main>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}><X /></IconButton>
        </div>
        <div className="modal-actions">{children}</div>
      </section>
    </div>
  )
}

function ScoreSheet({ cell, onClose, onScore, playerName }) {
  const { cat } = cell
  const option = (label, entry, key = label, emphasis = false) => (
    <button
      key={key}
      className={emphasis ? 'score-option score-option-served' : 'score-option'}
      onClick={() => onScore(entry)}
    >
      {label}
      {emphasis ? <Sun /> : null}
    </button>
  )

  return (
    <Modal title={`${playerName} · ${cat.label}`} onClose={onClose}>
      <div className={cat.face ? 'score-options score-options-numeric' : 'score-options'}>
        {cat.face
          ? [0, 1, 2, 3, 4, 5].map((count) => option(
              `${count * cat.face} puntos`,
              { pts: count * cat.face },
              count,
            ))
          : cell.locked
            ? []
            : cat.servidaGana
              ? [
                  option(`${cat.label} · ${cat.pts}`, { pts: cat.pts }),
                  option('Servida · gana la partida', { pts: cat.pts, servida: true }, 'servida', true),
                ]
              : cat.servida
                ? [
                    option(`Armada · ${cat.pts}`, { pts: cat.pts }),
                    option(`Servida · ${cat.servida}`, { pts: cat.servida, servida: true }, 'servida', true),
                  ]
                : [option(`${cat.label} · ${cat.pts}`, { pts: cat.pts })]}
        {option('Tachar categoría', { pts: 0, tachado: true })}
      </div>
      {cell.locked ? <p className="locked-note">La Doble se habilita después de anotar Generala.</p> : null}
    </Modal>
  )
}

function Over({ game, setScreen, dark, setDark }) {
  const winnerIndexes = winners(game)
  const isTie = winnerIndexes.length > 1
  const isServida = game.servidaWinner !== null
  const endedEarly = game.ended === true
  const winnerNames = winnerIndexes.map((index) => game.players[index])
  const ranked = game.players
    .map((name, index) => ({ name, total: total(game.scores[index]), index }))
    .sort((a, b) => {
      const aWon = winnerIndexes.includes(a.index)
      const bWon = winnerIndexes.includes(b.index)
      if (aWon !== bWon) return aWon ? -1 : 1
      return b.total - a.total || a.index - b.index
    })

  return (
    <main className="page-screen over-screen">
      <ScreenHeader title="Resultado" onBack={() => setScreen('home')} dark={dark} setDark={setDark} />
      <section className="page-content over-content">
        <div className="winner-symbol"><Trophy /></div>
        <p className="eyebrow">{isServida ? 'Generala servida' : endedEarly ? 'Partida cerrada' : isTie ? 'Final empatado' : 'Fin de la partida'}</p>
        <h2>{isTie ? `Empate: ${winnerNames.join(' y ')}` : `Ganó ${winnerNames[0]}`}</h2>
        {isTie ? <p className="result-copy">La mesa decide una mano de desempate.</p> : null}

        <ol className="ranking-list">
          {ranked.map((player, index) => (
            <li key={player.index} className={winnerIndexes.includes(player.index) ? 'ranking-winner' : ''}>
              <span className="rank-number">{index + 1}</span>
              <strong>{player.name}</strong>
              {winnerIndexes.includes(player.index) ? (
                <span className="winner-crown" aria-label="Ganador"><Crown /></span>
              ) : (
                <span>{player.total} pts.</span>
              )}
            </li>
          ))}
        </ol>

        <button className={`${primary} start-button`} onClick={() => setScreen('setup')}>
          <Plus /> Nueva partida
        </button>
        <button className={secondary} onClick={() => setScreen('home')}>Volver al inicio</button>
      </section>
    </main>
  )
}

function History({ setScreen, dark, setDark, historyVersion, syncRemoteHistory }) {
  const [games, setGames] = useState(() => load(STORAGE.history, []))
  const [syncState, setSyncState] = useState('idle')
  const remoteEnabled = Boolean(readRemoteConfig()?.enabled)

  useEffect(() => {
    setGames(load(STORAGE.history, []))
  }, [historyVersion])

  const refresh = () => {
    if (!remoteEnabled) return
    setSyncState('loading')
    syncRemoteHistory()
      .then(() => setSyncState('idle'))
      .catch(() => setSyncState('error'))
  }

  useEffect(refresh, [])

  const remove = (index) => {
    const removed = games[index]
    const remaining = games.filter((_, gameIndex) => gameIndex !== index)
    setGames(remaining)
    save(STORAGE.history, remaining)
    if (removed.id) {
      save(STORAGE.deleted, [...new Set([...load(STORAGE.deleted, []), removed.id])])
      const remoteConfig = readRemoteConfig()
      if (remoteConfig?.enabled) {
        setSyncState('loading')
        saveRemoteDeletion(remoteConfig, removed.id)
          .then(() => setSyncState('idle'))
          .catch(() => setSyncState('error'))
      }
    }
  }

  const stats = {}
  for (const game of games) {
    const gameWinners = game.winners ?? [game.winner]
    for (const player of game.players) {
      const stat = (stats[player.name] ??= { games: 0, wins: 0, points: 0, generalas: 0 })
      stat.games += 1
      stat.points += player.total
      if (player.generala) stat.generalas += 1
      if (gameWinners.includes(player.name)) stat.wins += 1
    }
  }
  const board = Object.entries(stats).sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins)

  return (
    <main className="page-screen">
      <ScreenHeader
        title="Historial"
        onBack={() => setScreen('home')}
        dark={dark}
        setDark={setDark}
        action={remoteEnabled ? (
          <IconButton label="Actualizar historial" onClick={refresh} disabled={syncState === 'loading'}>
            <RefreshCw className={syncState === 'loading' ? 'animate-spin' : undefined} />
          </IconButton>
        ) : null}
      />
      <section className="page-content history-content">
        {syncState === 'error' ? (
          <p className="settings-status settings-status-error" role="alert">
            No se pudo sincronizar. Revisá la conexión o los ajustes.
          </p>
        ) : null}
        {games.length === 0 ? (
          <div className="empty-state">
            <HistoryIcon />
            <h2>Todavía no hay partidas</h2>
            <p>Los resultados terminados van a aparecer acá.</p>
          </div>
        ) : (
          <>
            <div className="section-heading compact-heading">
              <span className="section-icon"><Trophy /></span>
              <div><p className="eyebrow">Tabla general</p><h2>La mesa</h2></div>
            </div>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead><tr><th>Jugador</th><th>PJ</th><th>PG</th><th>Pts.</th><th>Gen.</th></tr></thead>
                <tbody>
                  {board.map(([name, stat]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{stat.games}</td>
                      <td>{stat.wins}</td>
                      <td>{stat.points}</td>
                      <td>{stat.generalas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="list-title">Últimas partidas</h2>
            <ul className="history-list">
              {games.map((game, index) => (
                <li key={`${game.date}-${index}`}>
                  <div className="history-date">
                    <time dateTime={new Date(game.date).toISOString()}>
                      {new Date(game.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </time>
                    {game.endedEarly ? <span className="history-status">Cierre manual</span> : null}
                    <IconButton label="Borrar partida" onClick={() => remove(index)}><Trash2 /></IconButton>
                  </div>
                  <div className="history-winner">
                    {game.servida ? <Sun /> : <Trophy />}
                    <strong>{(game.winners?.length ?? 1) > 1 ? `Empate: ${game.winner}` : game.winner}</strong>
                  </div>
                  <p>{game.players.map((player) => `${player.name} ${player.total}`).join(' · ')}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}

function Settings({ setScreen, dark, setDark, syncRemoteHistory }) {
  const stored = readRemoteConfig()
  const [url, setUrl] = useState(stored?.url ?? '')
  const [key, setKey] = useState(stored?.key ?? '')
  const [enabled, setEnabled] = useState(stored?.enabled ?? true)
  const [hasStoredConfig, setHasStoredConfig] = useState(Boolean(stored))
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  const config = { url, key, enabled }

  const test = async () => {
    setStatus({ type: 'loading', message: 'Probando conexión…' })
    try {
      await testRemoteConnection(config)
      setStatus({ type: 'success', message: 'Conexión correcta.' })
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
      return false
    }
  }

  const storeAndSync = async () => {
    setStatus({ type: 'loading', message: enabled ? 'Guardando y sincronizando…' : 'Guardando…' })
    try {
      const savedConfig = saveRemoteConfig(config)
      setHasStoredConfig(true)
      if (enabled) {
        await testRemoteConnection(savedConfig)
        await syncRemoteHistory(savedConfig)
      }
      setStatus({ type: 'success', message: enabled ? 'Ajustes guardados e historial sincronizado.' : 'Ajustes guardados.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  const remove = () => {
    removeRemoteConfig()
    setUrl('')
    setKey('')
    setEnabled(true)
    setHasStoredConfig(false)
    setStatus({ type: 'success', message: 'Credenciales eliminadas de este dispositivo.' })
  }

  const busy = status.type === 'loading'

  return (
    <main className="page-screen">
      <ScreenHeader title="Ajustes" onBack={() => setScreen('home')} dark={dark} setDark={setDark} />
      <section className="page-content settings-content">
        <div className="section-heading">
          <span className="section-icon"><Cloud /></span>
          <div><p className="eyebrow">Almacenamiento remoto</p><h2>Supabase</h2></div>
        </div>

        <div className="security-notice">
          <strong>Clave guardada sólo en este dispositivo</strong>
          <p>Usá un proyecto dedicado a Generala. Cualquiera con la URL y esta clave puede ver y borrar el historial: compartilas sólo con tu casa.</p>
        </div>

        <div className="settings-fields">
          <label htmlFor="supabase-url">URL del proyecto</label>
          <input
            id="supabase-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://proyecto.supabase.co"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />

          <label htmlFor="supabase-key">Clave publicable</label>
          <div className="secret-input">
            <input
              id="supabase-key"
              type={showKey ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              placeholder="sb_publishable_…"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <IconButton label={showKey ? 'Ocultar clave' : 'Mostrar clave'} onClick={() => setShowKey((visible) => !visible)}>
              {showKey ? <EyeOff /> : <Eye />}
            </IconButton>
          </div>
        </div>

        <label className="sync-toggle">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span><strong>Sincronización activa</strong><small>Guarda resultados terminados y recupera el historial.</small></span>
        </label>

        {status.message ? (
          <p className={`settings-status settings-status-${status.type}`} role="status">
            {status.type === 'success' ? <CheckCircle2 /> : null}
            {status.message}
          </p>
        ) : null}

        <div className="settings-actions">
          <button className={secondary} onClick={test} disabled={busy || !url.trim() || !key.trim()}>Probar conexión</button>
          <button className={primary} onClick={storeAndSync} disabled={busy || !url.trim() || !key.trim()}>
            <Cloud /> {enabled ? 'Guardar y sincronizar' : 'Guardar ajustes'}
          </button>
          {hasStoredConfig ? <button className="settings-remove" onClick={remove}>Eliminar credenciales</button> : null}
        </div>

        <p className="settings-table-note">Tabla requerida: <code>public.generala_games</code></p>
      </section>
    </main>
  )
}

function Rules({ setScreen, dark, setDark, game }) {
  return (
    <main className="page-screen">
      <ScreenHeader title="Reglas" onBack={() => setScreen(game && !isOver(game) ? 'game' : 'home')} dark={dark} setDark={setDark} />
      <section className="page-content rules-content">
        <div className="rules-intro">
          <BrandMark compact />
          <div><p className="eyebrow">Variante argentina</p><h2>Generala clásica</h2></div>
        </div>

        <section className="rule-section">
          <span className="rule-number">01</span>
          <div><h3>La vuelta</h3><p>Cada jugador tira cinco dados hasta tres veces. Al cerrar el turno anota una categoría libre o la tacha.</p></div>
        </section>
        <section className="rule-section">
          <span className="rule-number">02</span>
          <div><h3>Números</h3><p>Del 1 al 6 se suma solamente el valor de los dados iguales. Cinco dados son el máximo de cada casillero.</p></div>
        </section>
        <section className="rule-section">
          <span className="rule-number">03</span>
          <div>
            <h3>Juegos mayores</h3>
            <dl className="rule-scores">
              <div><dt>Escalera</dt><dd>20 / 25 servida</dd></div>
              <div><dt>Full</dt><dd>30 / 35 servida</dd></div>
              <div><dt>Póker</dt><dd>40 / 45 servida</dd></div>
              <div><dt>Generala</dt><dd>50</dd></div>
              <div><dt>Generala Doble</dt><dd>100</dd></div>
            </dl>
          </div>
        </section>
        <section className="rule-section rule-highlight">
          <span className="rule-number"><Sun /></span>
          <div><h3>Servida</h3><p>Escalera, Full o Póker en el primer tiro suman 5 puntos extra. Una Generala servida gana la partida en el acto; la Generala Doble servida también.</p></div>
        </section>
        <section className="rule-section">
          <span className="rule-number">04</span>
          <div><h3>Final</h3><p>Gana el puntaje total más alto. Si hay empate, la mesa juega una mano adicional de desempate.</p></div>
        </section>
      </section>
    </main>
  )
}
