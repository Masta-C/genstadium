import { Redirect } from 'expo-router'

// Root layout auth guard redirects unauthenticated users to login before this renders.
// When we reach here, user is always authenticated — send them to Director home.
export default function Index() {
  return <Redirect href="/(director)/home" />
}
