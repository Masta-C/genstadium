import { router } from 'expo-router'
import { signOut as firebaseSignOut } from 'firebase/auth'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { auth } from '../../lib/firebase/client'
import { useAuthStore } from '../../store/authStore'

// Placeholder Director home screen — full implementation in later issues.
// Provides sign-out functionality to validate the auth guard loop.
export default function DirectorHomeScreen() {
  const { user, signOut } = useAuthStore()

  async function handleSignOut() {
    await firebaseSignOut(auth)
    signOut() // clears Zustand — root layout redirects to login automatically
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>GenStadium</Text>
      <Text style={styles.subheading}>Director Dashboard</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(director)/create')} activeOpacity={0.8}>
        <Text style={styles.createButtonText}>+ New Session</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    color: '#1DB954',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subheading: {
    color: '#B3B3B3',
    fontSize: 16,
    marginBottom: 8,
  },
  email: {
    color: '#535353',
    fontSize: 14,
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: 12,
  },
  signOutText: {
    color: '#535353',
    fontSize: 15,
  },
})
