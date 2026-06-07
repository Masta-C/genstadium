import { router } from 'expo-router'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { z } from 'zod'
import { auth, db } from '../../lib/firebase/client'

const signUpSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
})

type FieldErrors = Partial<Record<'displayName' | 'email' | 'password' | 'form', string>>

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setErrors({})
    const result = signUpSchema.safeParse({ displayName, email, password })
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const { user } = credential

      // Set display name on the Firebase Auth profile
      await updateProfile(user, { displayName: displayName.trim() })

      // Write Director profile to Firestore
      // linkWithCredential order: Firestore write AFTER auth user is created (never before)
      await setDoc(doc(db, `users/${user.uid}`), {
        uid: user.uid,
        email: user.email,
        displayName: displayName.trim(),
        role: 'director',
        createdAt: serverTimestamp(),
      })

      router.replace('/(director)/home')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/email-already-in-use') {
        setErrors({ email: 'An account with this email already exists.' })
      } else if (code === 'auth/weak-password') {
        setErrors({ password: 'Password is too weak.' })
      } else {
        setErrors({ form: 'Sign up failed. Check your connection and try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>GenStadium</Text>
        <Text style={styles.heading}>Create account</Text>

        <TextInput
          style={[styles.input, errors.displayName ? styles.inputError : null]}
          placeholder="Your name"
          placeholderTextColor="#535353"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
        />
        {errors.displayName ? <Text style={styles.fieldError}>{errors.displayName}</Text> : null}

        <TextInput
          style={[styles.input, errors.email ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor="#535353"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

        <TextInput
          style={[styles.input, errors.password ? styles.inputError : null]}
          placeholder="Password (8+ chars, 1 uppercase, 1 number)"
          placeholderTextColor="#535353"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#121212" />
          ) : (
            <Text style={styles.primaryButtonText}>Create account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    color: '#1DB954',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 32,
    textAlign: 'center',
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  inputError: { borderColor: '#E91429' },
  fieldError: {
    color: '#E91429',
    fontSize: 13,
    marginBottom: 8,
  },
  formError: {
    color: '#E91429',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: '#E9142915',
    padding: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
  },
  switchLink: {
    color: '#1DB954',
    fontWeight: '600',
  },
})
