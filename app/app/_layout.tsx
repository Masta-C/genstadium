import '../global.css'
import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'

export default function RootLayout() {
  // Subscribe to Firebase Auth → keeps Zustand authStore in sync
  useAuth()

  const { user, loading } = useAuthStore()

  // While Firebase resolves the persisted session — show a dark splash
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    )
  }

  // Unauthenticated — always send to login
  // The (auth) layout is a pass-through (no redirect logic there) so this
  // redirect is the single source of truth. Prevents bounce-back-to-login bug.
  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF',
        contentStyle: { backgroundColor: '#121212' },
      }}
    />
  )
}
