/**
 * AnimationPreviewModal.tsx — Looping animation preview for Director.
 *
 * Shows a 16:9 mock broadcast frame with placeholder data and loops the
 * selected animation style. Triggered by ▶ Preview in the Animations screen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'

type AnimationStyle = 'score-flash' | 'alert-banner' | 'lower-third' | 'none'

interface Props {
  visible: boolean
  eventLabel: string
  animStyle: AnimationStyle
  onClose: () => void
}

const PLACEHOLDER_TEAM = 'Mumbai FC'
const PLACEHOLDER_PLAYER = 'A. Sharma'
const PLACEHOLDER_SCORE = '1 – 0'

export default function AnimationPreviewModal({ visible, eventLabel, animStyle, onClose }: Props) {
  const [replayKey, setReplayKey] = useState(0)

  function handleReplay() {
    setReplayKey((k) => k + 1)
  }

  const screenWidth = Dimensions.get('window').width - 48
  const frameHeight = (screenWidth * 9) / 16

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>Preview</Text>
              <Text style={styles.subtitle}>
                {eventLabel} · {ANIMATION_STYLE_LABELS[animStyle]}
              </Text>

              {/* 16:9 mock broadcast frame */}
              <View
                style={[
                  styles.broadcastFrame,
                  { width: screenWidth, height: frameHeight },
                ]}
              >
                {/* Simulated camera feed texture */}
                <View style={styles.cameraFeedBg}>
                  <Text style={styles.cameraFeedText}>📷 Live Feed</Text>
                </View>

                {/* Animation layer */}
                <AnimationLayer
                  key={replayKey}
                  animStyle={animStyle}
                  eventLabel={eventLabel}
                  frameWidth={screenWidth}
                  frameHeight={frameHeight}
                />
              </View>

              {/* Controls */}
              <View style={styles.controls}>
                <TouchableOpacity style={styles.replayButton} onPress={handleReplay} activeOpacity={0.8}>
                  <Text style={styles.replayButtonText}>↺ Replay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const ANIMATION_STYLE_LABELS: Record<AnimationStyle, string> = {
  'score-flash': 'Score Flash',
  'alert-banner': 'Alert Banner',
  'lower-third': 'Lower Third',
  'none': 'No Animation',
}

// ---------------------------------------------------------------------------
// Animation layers per style
// ---------------------------------------------------------------------------

interface LayerProps {
  animStyle: AnimationStyle
  eventLabel: string
  frameWidth: number
  frameHeight: number
}

interface SubLayerProps {
  eventLabel: string
  frameWidth: number
  frameHeight: number
}

function AnimationLayer({ animStyle, eventLabel, frameWidth, frameHeight }: LayerProps) {
  switch (animStyle) {
    case 'lower-third':
      return (
        <LowerThirdLayer eventLabel={eventLabel} frameWidth={frameWidth} frameHeight={frameHeight} />
      )
    case 'score-flash':
      return <ScoreFlashLayer frameWidth={frameWidth} />
    case 'alert-banner':
      return <AlertBannerLayer eventLabel={eventLabel} frameWidth={frameWidth} />
    case 'none':
      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.noneOverlay}>
            <Text style={styles.noneText}>No animation</Text>
          </View>
        </View>
      )
  }
}

// Lower third: slides up 300ms → holds 3s → slides down 200ms → loops
function LowerThirdLayer({ eventLabel, frameWidth, frameHeight }: SubLayerProps) {
  const translateY = useRef(new Animated.Value(frameHeight * 0.25)).current

  const runLoop = useCallback(() => {
    translateY.setValue(frameHeight * 0.25)
    Animated.sequence([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(translateY, {
        toValue: frameHeight * 0.25,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(500),
    ]).start(({ finished }) => {
      if (finished) runLoop()
    })
  }, [translateY, frameHeight])

  useEffect(() => {
    runLoop()
    return () => translateY.stopAnimation()
  }, [runLoop, translateY])

  const safeInset = frameWidth * 0.05
  const panelWidth = Math.min(frameWidth * 0.55, 240)

  return (
    <Animated.View
      style={[
        styles.lowerThirdContainer,
        {
          bottom: safeInset,
          left: safeInset,
          width: panelWidth,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.lowerThirdAccent} />
      <View style={styles.lowerThirdBody}>
        <Text style={styles.lowerThirdEventLabel} numberOfLines={1}>
          {eventLabel.toUpperCase()}
        </Text>
        <Text style={styles.lowerThirdPlayer} numberOfLines={1}>
          {PLACEHOLDER_PLAYER}
        </Text>
        <Text style={styles.lowerThirdTeam} numberOfLines={1}>
          {PLACEHOLDER_TEAM}
        </Text>
      </View>
    </Animated.View>
  )
}

// Score flash: score scales 1→1.3→1 with green tint, loops
function ScoreFlashLayer({ frameWidth }: Pick<SubLayerProps, 'frameWidth'>) {
  const scale = useRef(new Animated.Value(1)).current
  const bgOpacity = useRef(new Animated.Value(0)).current

  const runLoop = useCallback(() => {
    scale.setValue(1)
    bgOpacity.setValue(0)
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1500),
    ]).start(({ finished }) => {
      if (finished) runLoop()
    })
  }, [scale, bgOpacity])

  useEffect(() => {
    runLoop()
    return () => {
      scale.stopAnimation()
      bgOpacity.stopAnimation()
    }
  }, [runLoop, scale, bgOpacity])

  const panelSize = Math.min(frameWidth * 0.28, 110)

  return (
    <View
      style={[
        styles.scorebugCorner,
        { width: panelSize, height: panelSize * 0.45 },
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.scorebugFlashBg,
          { opacity: bgOpacity },
        ]}
      />
      <View style={styles.scorebugContent}>
        <Text style={styles.scorebugTeam} numberOfLines={1}>
          {PLACEHOLDER_TEAM.split(' ')[0]}
        </Text>
        <Animated.Text
          style={[
            styles.scorebugScore,
            { transform: [{ scale }], fontSize: panelSize * 0.22 },
          ]}
        >
          {PLACEHOLDER_SCORE}
        </Animated.Text>
      </View>
    </View>
  )
}

// Alert banner: fades in from top → holds 2s → fades out → loops
function AlertBannerLayer({ eventLabel, frameWidth }: Pick<SubLayerProps, 'eventLabel' | 'frameWidth'>) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current

  const runLoop = useCallback(() => {
    opacity.setValue(0)
    translateY.setValue(-20)
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(2000),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(500),
    ]).start(({ finished }) => {
      if (finished) runLoop()
    })
  }, [opacity, translateY])

  useEffect(() => {
    runLoop()
    return () => {
      opacity.stopAnimation()
      translateY.stopAnimation()
    }
  }, [runLoop, opacity, translateY])

  return (
    <Animated.View
      style={[
        styles.alertBannerContainer,
        { width: frameWidth, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.alertBanner}>
        <Text style={styles.alertBannerEvent} numberOfLines={1}>
          {eventLabel.toUpperCase()}
        </Text>
        <Text style={styles.alertBannerDetail} numberOfLines={1}>
          {PLACEHOLDER_PLAYER} · {PLACEHOLDER_TEAM} · {PLACEHOLDER_SCORE}
        </Text>
      </View>
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  title: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  // 16:9 broadcast frame
  broadcastFrame: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cameraFeedBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFeedText: {
    color: '#1A2030',
    fontSize: 24,
    fontWeight: '700',
  },
  // Controls
  controls: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  replayButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  replayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  // None overlay
  noneOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noneText: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  // Lower third elements
  lowerThirdContainer: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 4,
  },
  lowerThirdAccent: {
    height: 3,
    backgroundColor: '#1DB954',
  },
  lowerThirdBody: {
    backgroundColor: 'rgba(29,185,84,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  lowerThirdEventLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lowerThirdPlayer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },
  lowerThirdTeam: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '500',
  },
  // Score flash
  scorebugCorner: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(18,18,18,0.9)',
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorebugFlashBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1DB954',
    opacity: 0,
  },
  scorebugContent: {
    alignItems: 'center',
    padding: 6,
  },
  scorebugTeam: {
    color: '#B3B3B3',
    fontSize: 10,
    fontWeight: '600',
  },
  scorebugScore: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  // Alert banner
  alertBannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
  },
  alertBanner: {
    backgroundColor: 'rgba(18,18,18,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    borderBottomWidth: 3,
    borderBottomColor: '#1DB954',
  },
  alertBannerEvent: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  alertBannerDetail: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
})
