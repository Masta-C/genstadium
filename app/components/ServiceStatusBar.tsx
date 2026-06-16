import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { ServiceHealth, ServiceStatus } from '../hooks/useServiceHealth'

interface Props {
  health: ServiceHealth
}

interface ChipProps {
  label: string
  status: ServiceStatus
  errorMessage?: string
}

function StatusChip({ label, status, errorMessage }: ChipProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const dot = status === 'ok' ? '🟢' : status === 'error' ? '🔴' : '⏳'
  const textColor =
    status === 'ok' ? styles.labelOk : status === 'error' ? styles.labelError : styles.labelChecking

  function handlePress() {
    if (status === 'error' && errorMessage) {
      setTooltipVisible((v) => !v)
    }
  }

  return (
    <View style={styles.chipWrapper}>
      <TouchableOpacity
        style={styles.chip}
        onPress={handlePress}
        activeOpacity={status === 'error' ? 0.7 : 1}
        disabled={status !== 'error'}
      >
        <Text style={styles.dot}>{dot}</Text>
        <Text style={[styles.label, textColor]}>{label}</Text>
      </TouchableOpacity>
      {tooltipVisible && errorMessage ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function ServiceStatusBar({ health }: Props) {
  return (
    <View style={styles.bar}>
      <StatusChip label="Firebase" status={health.firebase} />
      <StatusChip
        label="Cloud Run"
        status={health.cloudRun}
        errorMessage={health.cloudRunError}
      />
      <StatusChip
        label="LiveKit"
        status={health.livekit}
        errorMessage={health.cloudRunError}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  chipWrapper: {
    flex: 1,
    position: 'relative',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  dot: {
    fontSize: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelOk: {
    color: '#1DB954',
  },
  labelError: {
    color: '#CC0000',
  },
  labelChecking: {
    color: '#535353',
  },
  tooltip: {
    position: 'absolute',
    top: 34,
    left: 0,
    right: 0,
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    padding: 8,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#CC000060',
  },
  tooltipText: {
    color: '#FF6B6B',
    fontSize: 11,
    lineHeight: 15,
  },
})
