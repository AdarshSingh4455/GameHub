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
}

export const FOOD_CATALOG = [
  'burger', 'pizza', 'donut', 'cake', 'cookie', 
  'croissant', 'sushi', 'cupcake', 'ice-cream', 'apple', 
  'strawberry', 'taco', 'fries', 'pancake', 'egg', 
  'lemon', 'orange', 'salad', 'pretzel', 'watermelon'
];

export const FOOD_DISPLAY_NAMES: Record<string, string> = {
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
  'watermelon': 'Juicy Watermelon'
};

// Similar looking groups to challenge memory in medium/hard
export const SIMILAR_GROUPS = [
  ['apple', 'orange', 'lemon', 'watermelon'], // fruits
  ['burger', 'taco', 'fries', 'sushi'],        // savory
  ['donut', 'cake', 'cookie', 'croissant', 'cupcake', 'ice-cream', 'pancake', 'pretzel'] // sweet
];

export function getDifficultyConfig(difficulty: 'easy' | 'medium' | 'hard') {
  switch (difficulty) {
    case 'easy':
      return {
        itemCount: 3,
        shapes: ['circle'] as const,
        previewDurationMs: 6000,
        enableRotation: false,
        minSpacing: 25,
        enableMirror: false
      };
    case 'medium':
      return {
        itemCount: 5,
        shapes: ['circle', 'square'] as const,
        previewDurationMs: 5000,
        enableRotation: true,
        minSpacing: 20,
        enableMirror: false
      };
    case 'hard':
      return {
        itemCount: 7, // 7 to 9
        shapes: ['circle', 'square', 'hexagon'] as const,
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
  
  const shape = prng.pick(config.shapes);
  const themes = ['neon-blue', 'neon-pink', 'neon-green', 'gold', 'cyberpunk', 'holo-purple'];
  const color = prng.pick(themes);
  
  const decos = ['none', 'star', 'stripes', 'dots'] as const;
  const decoration = difficulty === 'easy' ? 'none' : prng.pick(decos);

  // Determine items count
  let itemCount = config.itemCount;
  if (difficulty === 'hard') {
    // 7, 8, or 9
    itemCount = Math.floor(prng.range(7, 10));
  }

  // Determine food selection. Harder modes use similar looking items.
  const selectedFoods: string[] = [];
  const useSimilar = difficulty !== 'easy' && prng.next() > 0.4;
  
  if (useSimilar) {
    const group = prng.pick(SIMILAR_GROUPS);
    for (let i = 0; i < itemCount; i++) {
      selectedFoods.push(prng.pick(group));
    }
  } else {
    for (let i = 0; i < itemCount; i++) {
      selectedFoods.push(prng.pick(FOOD_CATALOG));
    }
  }

  const foods: FoodPlacement[] = [];
  const maxTries = 100;

  for (let i = 0; i < itemCount; i++) {
    const type = selectedFoods[i];
    let placed = false;
    let tryCount = 0;

    while (!placed && tryCount < maxTries) {
      tryCount++;
      // Radius limit on placement (plate radius is 50, keep foods within 36 radius)
      const radiusLimit = 35;
      const angle = prng.range(0, Math.PI * 2);
      const dist = prng.range(0, radiusLimit);
      
      const x = Math.round(Math.cos(angle) * dist);
      const y = Math.round(Math.sin(angle) * dist);
      
      // Check collision/overlap with already placed foods
      let collision = false;
      for (const p of foods) {
        const dx = p.x - x;
        const dy = p.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < config.minSpacing) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        // rotation in steps of 90 degrees if rotation enabled
        const rotation = config.enableRotation ? prng.pick([0, 90, 180, 270]) : 0;
        const scale = parseFloat(prng.range(0.85, 1.05).toFixed(2));
        
        foods.push({
          id: `food-${i}-${Date.now()}-${Math.floor(prng.range(0, 1000))}`,
          type,
          x,
          y,
          rotation,
          scale
        });
        placed = true;
      }
    }
    
    // Fallback if placement fails, place anyway but with less strict spacing
    if (!placed) {
      const angle = prng.range(0, Math.PI * 2);
      const dist = prng.range(0, 32);
      const x = Math.round(Math.cos(angle) * dist);
      const y = Math.round(Math.sin(angle) * dist);
      const rotation = config.enableRotation ? prng.pick([0, 90, 180, 270]) : 0;
      
      foods.push({
        id: `food-fallback-${i}`,
        type,
        x,
        y,
        rotation,
        scale: 1.0
      });
    }
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
    plateShape: shape,
    plateColor: color,
    decorationStyle: decoration,
    foods,
    previewDurationMs: config.previewDurationMs,
    isMirrored
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
