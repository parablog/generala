import assert from 'node:assert'
import { mergeHistory, planSync, validateRemoteConfig } from './remote.js'

assert.doesNotThrow(() => validateRemoteConfig({ url: 'https://example.supabase.co/', key: 'secret' }))
assert.throws(() => validateRemoteConfig({ url: 'not-a-url', key: 'secret' }), /URL/)
assert.throws(() => validateRemoteConfig({ url: 'http://example.com', key: 'secret' }), /HTTPS/)
assert.throws(() => validateRemoteConfig({ url: 'https://example.com', key: ' ' }), /clave/)

const local = [
  { id: 'local', date: 30, winner: 'Ana' },
  { id: 'shared', date: 20, winner: 'Beto', source: 'local' },
]
const remote = [
  { id: 'remote', date: 40, winner: 'Caro' },
  { id: 'shared', date: 20, winner: 'Beto', source: 'remote' },
]
const merged = mergeHistory(local, remote)
assert.deepEqual(merged.map(({ id }) => id), ['remote', 'local', 'shared'])
assert.equal(merged.find(({ id }) => id === 'shared').source, 'remote')

// planSync: upload only what remote lacks, delete tombstoned, exclude tombstoned from merge
const plan = planSync(local, remote, ['remote'])
assert.deepEqual(plan.toUpload.map(({ id }) => id), ['local'])
assert.deepEqual(plan.toDelete, ['remote'])
assert.deepEqual(plan.merged.map(({ id }) => id), ['local', 'shared'])

console.log('ok')
