import React, { act } from 'react'
import { TouchableOpacity } from 'react-native'
import { create } from 'react-test-renderer'
import { ServiceStatusBar } from '../ServiceStatusBar'
import type { ServiceHealth } from '../../hooks/useServiceHealth'

const allOk: ServiceHealth = {
  firebase: 'ok',
  cloudRun: 'ok',
  livekit: 'ok',
}

const allChecking: ServiceHealth = {
  firebase: 'checking',
  cloudRun: 'checking',
  livekit: 'checking',
}

const withErrors: ServiceHealth = {
  firebase: 'error',
  cloudRun: 'error',
  livekit: 'error',
  cloudRunError: 'LiveKit: timeout',
}

test('renders 3 chips with ok labels', () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: allOk }))
  const json = renderer.toJSON()
  const text = JSON.stringify(json)
  expect(text).toContain('Firebase')
  expect(text).toContain('Cloud Run')
  expect(text).toContain('LiveKit')
})

test('renders checking state with grey dots', () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: allChecking }))
  const text = JSON.stringify(renderer.toJSON())
  expect(text).toContain('⏳')
})

test('renders ok state with green dots', () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: allOk }))
  const text = JSON.stringify(renderer.toJSON())
  expect(text).toContain('🟢')
})

test('renders error state with red dots', () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: withErrors }))
  const text = JSON.stringify(renderer.toJSON())
  expect(text).toContain('🔴')
})

test('tooltip hidden by default', () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: withErrors }))
  const text = JSON.stringify(renderer.toJSON())
  expect(text).not.toContain('LiveKit: timeout')
})

test('tapping a red chip with errorMessage shows tooltip', async () => {
  const renderer = create(React.createElement(ServiceStatusBar, { health: withErrors }))

  // Chips render in order: Firebase (idx 0), Cloud Run (idx 1), LiveKit (idx 2).
  // Cloud Run and LiveKit have errorMessage set; Firebase does not.
  const root = renderer.root
  const touchables = root.findAllByType(TouchableOpacity)
  // Cloud Run chip is at index 1
  const cloudRunChip = touchables[1]
  if (!cloudRunChip) throw new Error('Cloud Run chip not found')

  await act(async () => {
    cloudRunChip.props.onPress()
  })

  const text = JSON.stringify(renderer.toJSON())
  expect(text).toContain('LiveKit: timeout')
})
