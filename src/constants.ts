export const servers = ['jp', 'en', 'tw', 'cn', 'kr'] as const
export const localizations = ['ja', 'en', 'zht', 'zhs', 'ko'] as const

export const bestdoriRoot = 'https://bestdori.com'

export const laneKeys = ['0', '1', '2', '3', '4', '5', '6'] as const

export const habahiroNoteKeys = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '0_1',
    '1_2',
    '2_3',
    '3_4',
    '4_5',
    '5_6',
    '0_1_2',
    '1_2_3',
    '2_3_4',
    '3_4_5',
    '4_5_6',
    '0_1_2_3',
    '1_2_3_4',
    '2_3_4_5',
    '3_4_5_6',
    '0_1_2_3_4',
    '1_2_3_4_5',
    '2_3_4_5_6',
    '0_1_2_3_4_5',
    '1_2_3_4_5_6',
    '0_1_2_3_4_5_6',
] as const

export const habahiroWidthKeys = ['1', '2', '3', '4', '5', '6', '7'] as const
export const habahiroFlickTopKeys = ['1', '2', '3'] as const

export const widthToHabahiroKey = {
    1: '3',
    2: '2_3',
    3: '2_3_4',
    4: '1_2_3_4',
    5: '1_2_3_4_5',
    6: '0_1_2_3_4_5',
    7: '0_1_2_3_4_5_6',
} as const

export const customName = {
    rhythm: (name: string) => `bandori:${name}`,
    directional: (name: string) => `bandori:${name}`,
    field: (name: string) => `bandori:${name}`,
} as const
