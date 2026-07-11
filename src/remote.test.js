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

// planSync: upload only what remote lacks, replicate tombstones, exclude deleted games
const plan = planSync(local, remote, ['remote'])
assert.deepEqual(plan.toUpload.map(({ id }) => id), ['local'])
assert.deepEqual(plan.toDelete, ['remote'])
assert.deepEqual(plan.deletedIds, ['remote'])
assert.deepEqual(plan.merged.map(({ id }) => id), ['local', 'shared'])

// a remote tombstone removes a stale local copy and is not uploaded again
const remoteTombstone = { id: 'shared', date: 50, deleted: true }
const propagated = planSync(local, [remoteTombstone], [])
assert.deepEqual(propagated.toUpload.map(({ id }) => id), ['local'])
assert.deepEqual(propagated.toDelete, [])
assert.deepEqual(propagated.deletedIds, ['shared'])
assert.deepEqual(propagated.merged.map(({ id }) => id), ['local'])

console.log('ok')
