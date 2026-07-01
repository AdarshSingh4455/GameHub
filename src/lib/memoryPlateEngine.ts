export class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export interface FoodPlacement {
  id: string;      // Unique instance ID
  type: string;    // 'burger', 'pizza', etc.
  x: number;       // Offset X (-40 to 40)
  y: number;       // Offset Y (-40 to 40)
  rotation: number;// Rotation in degrees (0, 90, 180, 270, etc.)
  scale: number;   // Visual scale factor
}

export interface PlateLayout {
  seed: number;
  difficulty: 'easy' | 'medium' | 'hard';
  plateShape: 'circle' | 'square' | 'hexagon';
  plateColor: string; // Theme/gradient name
  decorationStyle: 'none' | 'star' | 'stripes' | 'dots';
  foods: FoodPlacement[];
  previewDurationMs: number;
  isMirrored?: boolean;
  surfaceType?: string;
  theme?: string;
}

export const FOOD_THEMES = {
  breakfast: [
    'egg', 'pancake', 'croissant', 'toast', 'juice', 'coffee', 'waffle',
    'bacon', 'sausage', 'oatmeal', 'muffin', 'tea', 'milk', 'yogurt'
  ],
  fastfood: [
    'burger', 'fries', 'pizza', 'taco', 'pretzel', 'donut', 'cookie',
    'hotdog', 'nuggets', 'onion-rings', 'sandwich', 'milkshake', 'popcorn', 'soda'
  ],
  fruits: [
    'apple', 'orange', 'lemon', 'watermelon', 'strawberry', 'banana', 'grapes',
    'cherry', 'peach', 'pineapple', 'mango', 'blueberry', 'kiwi', 'pear'
  ],
  desserts: [
    'cake', 'donut', 'cookie', 'ice-cream', 'cupcake', 'pie', 'chocolate',
    'pudding', 'macaron', 'candy', 'lollipop', 'brownie', 'tart', 'jelly'
  ],
  asian: [
    'sushi', 'dumplings', 'ramen', 'rice-bowl', 'spring-roll', 'tempura', 'boba',
    'green-tea', 'dim-sum', 'bao', 'wonton', 'mochi', 'skewer', 'tofu'
  ]
} as const;

export const FOOD_CATALOG = Array.from(
  new Set(Object.values(FOOD_THEMES).flat())
);

export const FOOD_DISPLAY_NAMES: Record<string, string> = {
  // Existing ones
  'burger': 'Premium Burger',
  'pizza': 'Hot Pizza Slice',
  'donut': 'Glazed Donut',
  'cake': 'Berry Cake Slice',
  'cookie': 'Choco-Chip Cookie',
  'croissant': 'Butter Croissant',
  'sushi': 'Maki Sushi Roll',
  'cupcake': 'Vanilla Cupcake',
  'ice-cream': 'Double Scoop Cone',
  'apple': 'Red Apple',
  'strawberry': 'Sweet Strawberry',
  'taco': 'Crunchy Taco',
  'fries': 'Golden French Fries',
  'pancake': 'Maple Pancake Stack',
  'egg': 'Sunny Side Up Egg',
  'lemon': 'Sour Lemon',
  'orange': 'Zesty Orange',
  'salad': 'Healthy Garden Salad',
  'pretzel': 'Salted Pretzel',
  'watermelon': 'Juicy Watermelon',
  
  // New Breakfast
  'toast': 'Butter Toast',
  'juice': 'Fresh Orange Juice',
  'coffee': 'Hot Espresso',
  'waffle': 'Belgian Waffle',
  'bacon': 'Crispy Bacon Strips',
  'sausage': 'Grilled Sausage',
  'oatmeal': 'Warm Oatmeal Bowl',
  'muffin': 'Blueberry Muffin',
  'tea': 'Chamomile Tea',
  'milk': 'Fresh Milk Glass',
  'yogurt': 'Greek Yogurt',
  
  // New Fast Food
  'hotdog': 'Classic Hotdog',
  'nuggets': 'Chicken Nuggets',
  'onion-rings': 'Crispy Onion Rings',
  'sandwich': 'Club Sandwich',
  'milkshake': 'Vanilla Milkshake',
  'popcorn': 'Butter Popcorn',
  'soda': 'Fizzy Soda Can',
  
  // New Fruits
  'banana': 'Ripe Banana',
  'grapes': 'Sweet Purple Grapes',
  'cherry': 'Red Cherries',
  'peach': 'Juicy Peach',
  'pineapple': 'Tropical Pineapple',
  'mango': 'Sweet Mango',
  'blueberry': 'Fresh Blueberries',
  'kiwi': 'Sliced Kiwi',
  'pear': 'Green Pear',
  
  // New Desserts
  'pie': 'Apple Pie Slice',
  'chocolate': 'Dark Chocolate Bar',
  'pudding': 'Caramel Pudding',
  'macaron': 'French Macarons',
  'candy': 'Fruit Candy',
  'lollipop': 'Swirl Lollipop',
  'brownie': 'Fudge Brownie',
  'tart': 'Fruit Tart',
  'jelly': 'Strawberry Jelly',
  
  // New Asian Cuisine
  'dumplings': 'Steamed Dumplings',
  'ramen': 'Shoyu Ramen Bowl',
  'rice-bowl': 'Teriyaki Rice Bowl',
  'spring-roll': 'Crispy Spring Rolls',
  'tempura': 'Shrimp Tempura',
  'boba': 'Brown Sugar Boba',
  'green-tea': 'Matcha Green Tea',
  'dim-sum': 'Dim Sum Basket',
  'bao': 'Steamed Pork Bao',
  'wonton': 'Fried Wontons',
  'mochi': 'Sweet Rice Mochi',
  'skewer': 'Chicken Yakitori',
  'tofu': 'Agedashi Tofu'
};

export interface Coordinate {
  x: number;
  y: number;
}

export const EASY_ANCHORS: Coordinate[] = [
  { x: 0, y: 0 },
  { x: 0, y: -26 },
  { x: 0, y: 26 },
  { x: -26, y: 0 },
  { x: 26, y: 0 },
  { x: -18, y: -18 },
  { x: 18, y: -18 },
  { x: -18, y: 18 },
  { x: 18, y: 18 }
];

export const MEDIUM_ANCHORS: Coordinate[] = [
  { x: -26, y: -26 }, { x: -9, y: -26 }, { x: 9, y: -26 }, { x: 26, y: -26 },
  { x: -26, y: -9 },  { x: -9, y: -9 },  { x: 9, y: -9 },  { x: 26, y: -9 },
  { x: -26, y: 9 },   { x: -9, y: 9 },   { x: 9, y: 9 },   { x: 26, y: 9 },
  { x: -26, y: 26 },  { x: -9, y: 26 },  { x: 9, y: 26 },  { x: 26, y: 26 }
];

export const HARD_ANCHORS: Coordinate[] = [
  // Dinner plate zone (near center/left)
  { x: -10, y: 10 },
  { x: -10, y: -2 },
  { x: -10, y: 22 },
  { x: -22, y: 10 },
  { x: 2, y: 10 },
  // Bowl zone (bottom-right)
  { x: 24, y: 24 },
  { x: 14, y: 24 },
  { x: 24, y: 14 },
  // Side plate / Serving board zone (left/top-left)
  { x: -28, y: -25 },
  { x: -18, y: -25 },
  { x: -28, y: -15 },
  // Cup/saucer area (top-right)
  { x: 26, y: -26 },
  { x: 16, y: -26 },
  { x: 26, y: -16 },
  // Placemat borders / ambient napkin placement
  { x: 10, y: -5 },
  { x: -5, y: -20 },
  { x: 20, y: 0 },
  { x: -30, y: 5 },
  { x: -30, y: 25 },
  { x: 0, y: 32 }
];

export function getDifficultyConfig(difficulty: 'easy' | 'medium' | 'hard') {
  switch (difficulty) {
    case 'easy':
      return {
        previewDurationMs: 6000,
        enableRotation: false,
        minSpacing: 25,
        enableMirror: false
      };
    case 'medium':
      return {
        previewDurationMs: 5000,
        enableRotation: true,
        minSpacing: 20,
        enableMirror: false
      };
    case 'hard':
      return {
        previewDurationMs: 4000,
        enableRotation: true,
        minSpacing: 16,
        enableMirror: true
      };
  }
}

export function generatePlateLayout(seed: number, difficulty: 'easy' | 'medium' | 'hard'): PlateLayout {
  const prng = new SeededRandom(seed);
  const config = getDifficultyConfig(difficulty);
  
  // Select theme randomly
  const themeList = ['breakfast', 'fastfood', 'fruits', 'desserts', 'asian'] as const;
  const theme = prng.pick(themeList);
  const themeFoods = FOOD_THEMES[theme];
  
  // Determine items count
  let itemCount = 4;
  if (difficulty === 'easy') {
    itemCount = Math.floor(prng.range(4, 7)); // 4 to 6
  } else if (difficulty === 'medium') {
    itemCount = Math.floor(prng.range(6, 10)); // 6 to 9
  } else {
    itemCount = Math.floor(prng.range(10, 15)); // 10 to 14
  }
  
  // Select items from the chosen theme without repetition
  const selectedFoods: string[] = [];
  const pool = [...themeFoods];
  for (let i = 0; i < itemCount; i++) {
    if (pool.length === 0) break;
    const idx = Math.floor(prng.range(0, pool.length));
    selectedFoods.push(pool.splice(idx, 1)[0]);
  }
  
  // Select surface type
  let surfaceType = 'ceramic';
  if (difficulty === 'easy') {
    surfaceType = 'ceramic';
  } else if (difficulty === 'medium') {
    surfaceType = prng.pick(['wood-tray', 'slate-board', 'square-platter', 'breakfast-tray']);
  } else {
    surfaceType = 'restaurant-table';
  }
  
  // Select anchors
  let anchorPool = difficulty === 'easy' 
    ? [...EASY_ANCHORS] 
    : difficulty === 'medium' 
      ? [...MEDIUM_ANCHORS] 
      : [...HARD_ANCHORS];
      
  const foods: FoodPlacement[] = [];
  for (let i = 0; i < selectedFoods.length; i++) {
    const type = selectedFoods[i];
    if (anchorPool.length === 0) break;
    const anchorIdx = Math.floor(prng.range(0, anchorPool.length));
    const anchor = anchorPool.splice(anchorIdx, 1)[0];
    
    const rotation = config.enableRotation ? prng.pick([0, 90, 180, 270]) : 0;
    const scale = parseFloat(prng.range(0.9, 1.1).toFixed(2));
    
    foods.push({
      id: `food-${i}-${Date.now()}-${Math.floor(prng.range(0, 1000))}`,
      type,
      x: anchor.x,
      y: anchor.y,
      rotation,
      scale
    });
  }

  // Mirror layout option for Hard difficulty
  const isMirrored = config.enableMirror && prng.next() > 0.5;
  if (isMirrored) {
    // Reflect all items horizontally across Y axis (x = -x)
    for (const f of foods) {
      f.x = -f.x;
      if (f.rotation === 90) f.rotation = 270;
      else if (f.rotation === 270) f.rotation = 90;
    }
  }

  return {
    seed,
    difficulty,
    plateShape: difficulty === 'easy' ? 'circle' : (difficulty === 'medium' ? 'square' : 'circle'),
    plateColor: 'ceramic',
    decorationStyle: 'none',
    foods,
    previewDurationMs: config.previewDurationMs,
    isMirrored,
    surfaceType,
    theme
  };
}

export interface MatchScoreResult {
  accuracy: number;     // 0 to 100
  score: number;        // Overall score earned
  correctCount: number; // Correct food items (approx location match)
  totalTarget: number;  // Target count
}

export function scorePlateSubmission(
  targetLayout: PlateLayout, 
  submission: Omit<FoodPlacement, 'id'>[], 
  timeRemainingSec: number,
  timeTotalSec: number
): MatchScoreResult {
  const targets = [...targetLayout.foods];
  const submitted = [...submission];
  const matchedTargetIds = new Set<string>();
  
  let correctCount = 0;
  const totalTarget = targets.length;
  let positionScoreAccumulator = 0;
  let rotationScoreAccumulator = 0;

  // We pair each submission with the closest correct target of matching type
  for (const sub of submitted) {
    let bestMatchIdx = -1;
    let minDistance = 99999;

    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      if (tgt.type !== sub.type || matchedTargetIds.has(tgt.id)) continue;

      const dx = tgt.x - sub.x;
      const dy = tgt.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance) {
        minDistance = dist;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx !== -1 && minDistance < 25) {
      // Valid match!
      const bestTarget = targets[bestMatchIdx];
      matchedTargetIds.add(bestTarget.id);
      correctCount++;

      // Position score: 100% if exact, drops linearly down to 0% at 25px distance
      const posPct = Math.max(0, 1 - minDistance / 25);
      positionScoreAccumulator += posPct;

      // Rotation score
      if (targetLayout.difficulty !== 'easy') {
        const rotDiff = Math.abs(bestTarget.rotation - sub.rotation) % 360;
        const normalizedDiff = rotDiff > 180 ? 360 - rotDiff : rotDiff;
        // 100% if exact, 50% if 90deg off, 0% if 180deg off
        const rotPct = Math.max(0, 1 - normalizedDiff / 180);
        rotationScoreAccumulator += rotPct;
      } else {
        rotationScoreAccumulator += 1; // Free rotation score for easy
      }
    }
  }

  // Calculate percentages
  const foodMatchPct = totalTarget > 0 ? correctCount / totalTarget : 0;
  const avgPosPct = correctCount > 0 ? positionScoreAccumulator / correctCount : 0;
  const avgRotPct = correctCount > 0 ? rotationScoreAccumulator / correctCount : 0;

  // Accuracy formula: 50% item match, 30% position, 20% rotation
  const accuracy = Math.round(
    (foodMatchPct * 50) + (foodMatchPct * avgPosPct * 30) + (foodMatchPct * avgRotPct * 20)
  );

  // Time bonus: up to 500 extra points for fast completion
  const timeBonusFraction = Math.max(0, timeRemainingSec / Math.max(1, timeTotalSec));
  const timeBonus = Math.round(timeBonusFraction * 500);

  // Base score: 1000 max score + timeBonus
  const score = Math.round((accuracy / 100) * 1000) + (accuracy > 50 ? timeBonus : 0);

  return {
    accuracy,
    score,
    correctCount,
    totalTarget
  };
}
