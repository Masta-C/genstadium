import { Stack } from 'expo-router'

export default function DirectorLayout() {
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
