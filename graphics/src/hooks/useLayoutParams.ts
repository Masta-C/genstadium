export function useLayoutParams(): {
  sessionId: string | null
  lkToken: string | null
  lkUrl: string | null
} {
  const params = new URLSearchParams(window.location.search)
  return {
    sessionId: params.get('layout'),
    lkToken: params.get('lk_token'),
    lkUrl: params.get('lk_url'),
  }
}
