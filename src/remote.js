const CONFIG_KEY = 'generala-supabase'
const TABLE = 'generala_games'

const cleanUrl = (value) => value.trim().replace(/\/+$/, '')

export const readRemoteConfig = () => {
  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')
    if (!config?.url || !config?.key) return null
    return { url: cleanUrl(config.url), key: config.key.trim(), enabled: config.enabled !== false }
  } catch {
    return null
  }
}

export const saveRemoteConfig = ({ url, key, enabled = true }) => {
  const config = { url: cleanUrl(url), key: key.trim(), enabled }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  return config
}

export const removeRemoteConfig = () => localStorage.removeItem(CONFIG_KEY)

export const validateRemoteConfig = ({ url, key }) => {
  let parsed
  try {
    parsed = new URL(cleanUrl(url))
  } catch {
    throw new Error('La URL de Supabase no es válida')
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
    throw new Error('La URL de Supabase debe usar HTTPS')
  }
  if (!key.trim()) throw new Error('Falta la clave del proyecto')
}

const remoteRequest = async (config, path, options = {}) => {
  validateRemoteConfig(config)
  const key = config.key.trim()
  const authHeaders = key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }
  const response = await fetch(`${cleanUrl(config.url)}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      ...authHeaders,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.hint ?? `Supabase respondió ${response.status}`)
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export const testRemoteConnection = (config) =>
  remoteRequest(config, `${TABLE}?select=id&limit=1`)

export const fetchRemoteHistory = (config) =>
  remoteRequest(config, `${TABLE}?select=id,payload&order=created_at.desc`)
    .then((rows) => rows.map(({ id, payload }) => ({ ...payload, id })))

export const saveRemoteHistoryEntry = (config, entry) =>
  remoteRequest(config, `${TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id: entry.id, payload: entry }),
  })

export const deleteRemoteHistoryEntry = (config, id) =>
  remoteRequest(config, `${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })

export const mergeHistory = (localGames, remoteGames) => {
  const merged = new Map()
  for (const game of [...remoteGames, ...localGames]) {
    const key = game.id ?? `${game.date}-${game.winner}-${game.players?.map(({ name }) => name).join('|')}`
    if (!merged.has(key)) merged.set(key, game)
  }
  return [...merged.values()].sort((a, b) => b.date - a.date)
}

export const planSync = (localGames, remoteGames, deletedIds = []) => {
  const deleted = new Set(deletedIds)
  const remoteIds = new Set(remoteGames.map(({ id }) => id))
  return {
    toUpload: localGames.filter(({ id }) => !remoteIds.has(id) && !deleted.has(id)),
    toDelete: [...deleted].filter((id) => remoteIds.has(id)),
    merged: mergeHistory(localGames, remoteGames).filter(({ id }) => !deleted.has(id)),
  }
}
