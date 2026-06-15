export interface BlockShape {
  id: string
  name: string
  grid: number[][]
  color: string
  difficulty: 'easy' | 'normal' | 'hard'
  width: number
  height: number
  blocksCount: number
}

export const SHAPES_CATALOG: BlockShape[] = [
  {
    id: 'single',
    name: 'Single',
    grid: [[1]],
    color: '#06b6d4', // Neon Cyan
    difficulty: 'easy',
    width: 1,
    height: 1,
    blocksCount: 1,
  },
  {
    id: 'line_h_2',
    name: 'Double Horizontal',
    grid: [[1, 1]],
    color: '#3b82f6', // Blue
    difficulty: 'easy',
    width: 2,
    height: 1,
    blocksCount: 2,
  },
  {
    id: 'line_v_2',
    name: 'Double Vertical',
    grid: [[1], [1]],
    color: '#3b82f6',
    difficulty: 'easy',
    width: 1,
    height: 2,
    blocksCount: 2,
  },
  {
    id: 'line_h_3',
    name: 'Triple Horizontal',
    grid: [[1, 1, 1]],
    color: '#8b5cf6', // Violet
    difficulty: 'easy',
    width: 3,
    height: 1,
    blocksCount: 3,
  },
  {
    id: 'line_v_3',
    name: 'Triple Vertical',
    grid: [[1], [1], [1]],
    color: '#8b5cf6',
    difficulty: 'easy',
    width: 1,
    height: 3,
    blocksCount: 3,
  },
  {
    id: 'line_h_4',
    name: '4-Line Horizontal',
    grid: [[1, 1, 1, 1]],
    color: '#f97316', // Orange
    difficulty: 'normal',
    width: 4,
    height: 1,
    blocksCount: 4,
  },
  {
    id: 'line_v_4',
    name: '4-Line Vertical',
    grid: [[1], [1], [1], [1]],
    color: '#f97316',
    difficulty: 'normal',
    width: 1,
    height: 4,
    blocksCount: 4,
  },
  {
    id: 'line_h_5',
    name: '5-Line Horizontal',
    grid: [[1, 1, 1, 1, 1]],
    color: '#f43f5e', // Rose
    difficulty: 'hard',
    width: 5,
    height: 1,
    blocksCount: 5,
  },
  {
    id: 'line_v_5',
    name: '5-Line Vertical',
    grid: [[1], [1], [1], [1], [1]],
    color: '#f43f5e',
    difficulty: 'hard',
    width: 1,
    height: 5,
    blocksCount: 5,
  },
  {
    id: 'square_2',
    name: 'Small Square',
    grid: [
      [1, 1],
      [1, 1],
    ],
    color: '#10b981', // Emerald
    difficulty: 'easy',
    width: 2,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 'square_3',
    name: 'Large Square',
    grid: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    color: '#d946ef', // Fuchsia
    difficulty: 'hard',
    width: 3,
    height: 3,
    blocksCount: 9,
  },
  // L Shapes
  {
    id: 'l_1',
    name: 'L-Shape Rot 0',
    grid: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    color: '#f59e0b', // Amber
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  {
    id: 'l_2',
    name: 'L-Shape Rot 90',
    grid: [
      [1, 1, 1],
      [1, 0, 0],
    ],
    color: '#f59e0b',
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 'l_3',
    name: 'L-Shape Rot 180',
    grid: [
      [1, 1],
      [0, 1],
      [0, 1],
    ],
    color: '#f59e0b',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  {
    id: 'l_4',
    name: 'L-Shape Rot 270',
    grid: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: '#f59e0b',
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  // Reverse L
  {
    id: 'rev_l_1',
    name: 'Reverse L Rot 0',
    grid: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
    color: '#a855f7', // Purple
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  {
    id: 'rev_l_2',
    name: 'Reverse L Rot 90',
    grid: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: '#a855f7',
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 'rev_l_3',
    name: 'Reverse L Rot 180',
    grid: [
      [1, 1],
      [1, 0],
      [1, 0],
    ],
    color: '#a855f7',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  {
    id: 'rev_l_4',
    name: 'Reverse L Rot 270',
    grid: [
      [1, 1, 1],
      [0, 0, 1],
    ],
    color: '#a855f7',
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  // T Shapes
  {
    id: 't_1',
    name: 'T-Shape Rot 0',
    grid: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: '#ec4899', // Pink
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 't_2',
    name: 'T-Shape Rot 90',
    grid: [
      [0, 1],
      [1, 1],
      [0, 1],
    ],
    color: '#ec4899',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  {
    id: 't_3',
    name: 'T-Shape Rot 180',
    grid: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: '#ec4899',
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 't_4',
    name: 'T-Shape Rot 270',
    grid: [
      [1, 0],
      [1, 1],
      [1, 0],
    ],
    color: '#ec4899',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  // Z Shapes
  {
    id: 'z_1',
    name: 'Z-Shape Horizontal',
    grid: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: '#14b8a6', // Teal
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 'z_2',
    name: 'Z-Shape Vertical',
    grid: [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    color: '#14b8a6',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  // Reverse Z Shapes
  {
    id: 'rev_z_1',
    name: 'Reverse Z Horizontal',
    grid: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: '#eab308', // Yellow
    difficulty: 'normal',
    width: 3,
    height: 2,
    blocksCount: 4,
  },
  {
    id: 'rev_z_2',
    name: 'Reverse Z Vertical',
    grid: [
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color: '#eab308',
    difficulty: 'normal',
    width: 2,
    height: 3,
    blocksCount: 4,
  },
  // Corners 2x2
  {
    id: 'corner_2_1',
    name: 'Small Corner Rot 0',
    grid: [
      [1, 1],
      [1, 0],
    ],
    color: '#06b6d4',
    difficulty: 'easy',
    width: 2,
    height: 2,
    blocksCount: 3,
  },
  {
    id: 'corner_2_2',
    name: 'Small Corner Rot 90',
    grid: [
      [1, 1],
      [0, 1],
    ],
    color: '#06b6d4',
    difficulty: 'easy',
    width: 2,
    height: 2,
    blocksCount: 3,
  },
  {
    id: 'corner_2_3',
    name: 'Small Corner Rot 180',
    grid: [
      [0, 1],
      [1, 1],
    ],
    color: '#06b6d4',
    difficulty: 'easy',
    width: 2,
    height: 2,
    blocksCount: 3,
  },
  {
    id: 'corner_2_4',
    name: 'Small Corner Rot 270',
    grid: [
      [1, 0],
      [1, 1],
    ],
    color: '#06b6d4',
    difficulty: 'easy',
    width: 2,
    height: 2,
    blocksCount: 3,
  },
  // Awkward / Hard Shapes
  {
    id: 'cross_3',
    name: 'Plus Shape',
    grid: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: '#ef4444', // Red
    difficulty: 'hard',
    width: 3,
    height: 3,
    blocksCount: 5,
  },
  {
    id: 'u_shape',
    name: 'U-Shape',
    grid: [
      [1, 0, 1],
      [1, 1, 1],
    ],
    color: '#f43f5e',
    difficulty: 'hard',
    width: 3,
    height: 2,
    blocksCount: 5,
  },
  {
    id: 'c_shape',
    name: 'C-Shape',
    grid: [
      [1, 1],
      [1, 0],
      [1, 1],
    ],
    color: '#3b82f6',
    difficulty: 'hard',
    width: 2,
    height: 3,
    blocksCount: 5,
  },
  {
    id: 'big_l_1',
    name: 'Big Corner 3x3',
    grid: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    color: '#f59e0b',
    difficulty: 'hard',
    width: 3,
    height: 3,
    blocksCount: 5,
  },
  {
    id: 'big_l_2',
    name: 'Big Corner 3x3 Rotated',
    grid: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    color: '#f59e0b',
    difficulty: 'hard',
    width: 3,
    height: 3,
    blocksCount: 5,
  },
]
