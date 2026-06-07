import '../global.css'
import { Stack } from 'expo-router'
import { useAuth } from '../hooks/useAuth'

export default function RootLayout() {
  // Subscribe to Firebase Auth state → syncs into Zustand authStore.
  // Mounted here so auth state is available across all screens.
  useAuth()

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
