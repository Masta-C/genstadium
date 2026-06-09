import { useLayoutParams } from '../useLayoutParams'

function withSearch(search: string) {
  vi.stubGlobal('location', { search })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('?layout=ABC123 → sessionId = ABC123', () => {
  withSearch('?layout=ABC123')
  expect(useLayoutParams().sessionId).toBe('ABC123')
})

test('?lk_token=tok&lk_url=wss://host → correct token and url', () => {
  withSearch('?lk_token=tok123&lk_url=wss%3A%2F%2Fhost')
  const { lkToken, lkUrl } = useLayoutParams()
  expect(lkToken).toBe('tok123')
  expect(lkUrl).toBe('wss://host')
})

test('all three params present', () => {
  withSearch('?layout=sess-1&lk_token=t&lk_url=wss://lk')
  const { sessionId, lkToken, lkUrl } = useLayoutParams()
  expect(sessionId).toBe('sess-1')
  expect(lkToken).toBe('t')
  expect(lkUrl).toBe('wss://lk')
})

test('no params → all null', () => {
  withSearch('')
  const { sessionId, lkToken, lkUrl } = useLayoutParams()
  expect(sessionId).toBeNull()
  expect(lkToken).toBeNull()
  expect(lkUrl).toBeNull()
})

test('?layout=TEST01 (documented test join code) resolves correctly', () => {
  withSearch('?layout=TEST01')
  expect(useLayoutParams().sessionId).toBe('TEST01')
})
