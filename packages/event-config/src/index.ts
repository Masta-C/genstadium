export type EventTrigger = 'prefetch' | 'animation'
export type EventTier = 1 | 2 | 3
export type ScoreDelta = { team: number } | null
export type ScorebugLayout =
  | 'soccer'
  | 'cricket'
  | 'basketball'
  | 'american_football'
  | 'pickleball'
  | 'badminton'
  | 'generic'
export type ScoreUnit = 'goals' | 'runs' | 'points'
export type SportKey =
  | 'soccer'
  | 'cricket'
  | 'basketball'
  | 'american_football'
  | 'pickleball'
  | 'badminton'
  | 'custom'

export interface SportEvent {
  id: string
  label: string
  tier: EventTier
  scoreDelta: ScoreDelta
  metadata: string[]
  triggers: EventTrigger[]
  isExtra?: boolean
  tip?: string
}

export interface SportConfig {
  displayName: string
  icon: string
  dataLabel: string
  entryLabel: string
  scoreUnit: ScoreUnit
  periods: string[]
  events: SportEvent[]
  scorebugLayout: ScorebugLayout
}

export const eventConfig: Record<SportKey, SportConfig> = {
  soccer: {
    displayName: 'Soccer',
    icon: '⚽',
    dataLabel: 'Teams',
    entryLabel: 'Score Keeper',
    scoreUnit: 'goals',
    periods: ['1st Half', '2nd Half', 'Extra Time 1', 'Extra Time 2'],
    scorebugLayout: 'soccer',
    events: [
      {
        id: 'goal',
        label: 'Goal',
        tier: 1,
        scoreDelta: { team: 1 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'own_goal',
        label: 'Own Goal',
        tier: 2,
        scoreDelta: { team: -1 },
        metadata: ['playerId'],
        triggers: ['animation'],
      },
      {
        id: 'yellow_card',
        label: 'Yellow Card',
        tier: 2,
        scoreDelta: null,
        metadata: ['playerId'],
        triggers: ['animation'],
      },
      {
        id: 'red_card',
        label: 'Red Card',
        tier: 2,
        scoreDelta: null,
        metadata: ['playerId'],
        triggers: ['animation'],
      },
      {
        id: 'penalty',
        label: 'Penalty',
        tier: 2,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Penalty awarded — does not auto-score',
      },
      {
        id: 'corner',
        label: 'CRN',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Corner kick awarded, stat only',
      },
      {
        id: 'offside',
        label: 'OFF',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Offside call, stat only',
      },
      {
        id: 'substitution',
        label: 'SUB',
        tier: 3,
        scoreDelta: null,
        metadata: ['playerIn', 'playerOut'],
        triggers: [],
        tip: 'Player substitution — tap to log who came on/off',
      },
    ],
  },

  cricket: {
    displayName: 'Cricket',
    icon: '🏏',
    dataLabel: 'Teams',
    entryLabel: 'Score Keeper',
    scoreUnit: 'runs',
    periods: ['1st Innings', '2nd Innings'],
    scorebugLayout: 'cricket',
    events: [
      {
        id: 'six',
        label: 'SIX',
        tier: 1,
        scoreDelta: { team: 6 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'four',
        label: 'FOUR',
        tier: 1,
        scoreDelta: { team: 4 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'wicket',
        label: 'Wicket',
        tier: 1,
        scoreDelta: null,
        metadata: ['bowler', 'dismissalType'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'runs_1',
        label: '1',
        tier: 2,
        scoreDelta: { team: 1 },
        metadata: ['playerId'],
        triggers: [],
      },
      {
        id: 'runs_2',
        label: '2',
        tier: 2,
        scoreDelta: { team: 2 },
        metadata: ['playerId'],
        triggers: [],
      },
      {
        id: 'runs_3',
        label: '3',
        tier: 2,
        scoreDelta: { team: 3 },
        metadata: ['playerId'],
        triggers: [],
      },
      {
        id: 'wide',
        label: 'WD',
        tier: 3,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
        isExtra: true,
        tip: 'Wide — adds 1 run, does not count as a legal delivery',
      },
      {
        id: 'no_ball',
        label: 'NB',
        tier: 3,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
        isExtra: true,
        tip: 'No Ball — adds 1 run, does not count as a legal delivery',
      },
      {
        id: 'bye',
        label: 'BYE',
        tier: 3,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
        tip: 'Bye — 1 run credited to extras, not to batsman',
      },
      {
        id: 'dot_ball',
        label: 'DOT',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Dot ball — no runs scored, legal delivery',
      },
      {
        id: 'end_innings',
        label: 'END INN',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'End innings — confirm before continuing',
      },
    ],
  },

  basketball: {
    displayName: 'Basketball',
    icon: '🏀',
    dataLabel: 'Teams',
    entryLabel: 'Score Keeper',
    scoreUnit: 'points',
    periods: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    scorebugLayout: 'basketball',
    events: [
      {
        id: 'points_3',
        label: '+3',
        tier: 1,
        scoreDelta: { team: 3 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'points_2',
        label: '+2',
        tier: 1,
        scoreDelta: { team: 2 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'points_1',
        label: '+1',
        tier: 2,
        scoreDelta: { team: 1 },
        metadata: ['playerId'],
        triggers: [],
      },
      {
        id: 'foul',
        label: 'Foul',
        tier: 2,
        scoreDelta: null,
        metadata: ['playerId'],
        triggers: ['animation'],
      },
      {
        id: 'timeout',
        label: 'T/O',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Timeout called by this team',
      },
      {
        id: 'block',
        label: 'BLK',
        tier: 3,
        scoreDelta: null,
        metadata: ['playerId'],
        triggers: [],
        tip: 'Block, stat only',
      },
      {
        id: 'steal',
        label: 'STL',
        tier: 3,
        scoreDelta: null,
        metadata: ['playerId'],
        triggers: [],
        tip: 'Steal, stat only',
      },
    ],
  },

  american_football: {
    displayName: 'American Football',
    icon: '🏈',
    dataLabel: 'Teams',
    entryLabel: 'Score Keeper',
    scoreUnit: 'points',
    periods: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    scorebugLayout: 'american_football',
    events: [
      {
        id: 'touchdown',
        label: 'TD',
        tier: 1,
        scoreDelta: { team: 6 },
        metadata: ['playerId'],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'field_goal',
        label: 'FG',
        tier: 1,
        scoreDelta: { team: 3 },
        metadata: [],
        triggers: ['prefetch', 'animation'],
      },
      {
        id: 'extra_point',
        label: 'XP',
        tier: 2,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
      },
      {
        id: 'two_point',
        label: '2-PT',
        tier: 2,
        scoreDelta: { team: 2 },
        metadata: [],
        triggers: [],
      },
      {
        id: 'safety',
        label: 'Safety',
        tier: 2,
        scoreDelta: { team: 2 },
        metadata: [],
        triggers: ['animation'],
      },
      {
        id: 'penalty',
        label: 'PEN',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Penalty — yardage stat only, does not change score',
      },
      {
        id: 'timeout',
        label: 'T/O',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Timeout called by this team',
      },
    ],
  },

  pickleball: {
    displayName: 'Pickleball',
    icon: '🏓',
    dataLabel: 'Players',
    entryLabel: 'Score Keeper',
    scoreUnit: 'points',
    periods: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
    scorebugLayout: 'pickleball',
    events: [
      {
        id: 'point_server',
        label: 'Point',
        tier: 1,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
      },
      {
        id: 'side_out',
        label: 'Side Out',
        tier: 1,
        scoreDelta: null,
        metadata: [],
        triggers: [],
      },
      {
        id: 'fault',
        label: 'Fault',
        tier: 2,
        scoreDelta: null,
        metadata: [],
        triggers: [],
      },
      {
        id: 'kitchen_fault',
        label: 'KIT',
        tier: 2,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Kitchen (non-volley zone) fault',
      },
      {
        id: 'timeout',
        label: 'T/O',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Timeout called by this team',
      },
    ],
  },

  badminton: {
    displayName: 'Badminton',
    icon: '🏸',
    dataLabel: 'Players',
    entryLabel: 'Score Keeper',
    scoreUnit: 'points',
    periods: ['Game 1', 'Game 2', 'Game 3'],
    scorebugLayout: 'badminton',
    events: [
      {
        id: 'point',
        label: 'Point',
        tier: 1,
        scoreDelta: { team: 1 },
        metadata: [],
        triggers: [],
      },
      {
        id: 'fault',
        label: 'Fault',
        tier: 2,
        scoreDelta: null,
        metadata: [],
        triggers: [],
      },
      {
        id: 'net_fault',
        label: 'NET',
        tier: 2,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Net fault — shuttle hit net',
      },
      {
        id: 'service_fault',
        label: 'SVC',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Service fault',
      },
      {
        id: 'let',
        label: 'LET',
        tier: 3,
        scoreDelta: null,
        metadata: [],
        triggers: [],
        tip: 'Let — rally to be replayed',
      },
    ],
  },

  custom: {
    displayName: 'Custom',
    icon: '🏆',
    dataLabel: 'Teams',
    entryLabel: 'Score Keeper',
    scoreUnit: 'points',
    periods: ['Period 1', 'Period 2'],
    scorebugLayout: 'generic',
    events: [],
  },
}
