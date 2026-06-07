import { Stack } from 'expo-router'

// Pass-through layout — no redirect logic here.
// Redirect logic lives in the root _layout.tsx only,
// to prevent the bounce-back-to-login bug.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF',
        contentStyle: { backgroundColor: '#121212' },
        headerShown: false,
      }}
    />
  )
}
