import { SeededRandom } from './memoryPlateEngine';

export type WeatherType = 'sunny' | 'sunset' | 'rain' | 'snow' | 'night' | 'goldenhour';
export type ObstacleType = 'bird' | 'cloud' | 'lightning' | 'plane' | 'balloon' | 'windmill';
export type PowerupType = 'shield' | 'slowmo' | 'magnet' | 'turbo' | 'double';

export interface ObstacleInstance {
  id: string;
  lane: number; // 0 (left), 1 (center), 2 (right)
  type: ObstacleType;
  distance: number; // Y position in distance units
  width: number;
  height: number;
}

export interface CollectibleInstance {
  id: string;
  lane: number;
  type: 'coin' | PowerupType;
  distance: number;
  width: number;
  height: number;
}

export interface SkyFlightConfig {
  weather: WeatherType;
  skyGradient: string[];
  baseSpeed: number;
  speedIncrement: number;
  obstacleSpacing: number;
  scoreMultiplier: number;
}

export const WEATHER_THEMES: Record<WeatherType, { sky: string[]; label: string }> = {
  sunny: { sky: ['#0284c7', '#38bdf8', '#bae6fd'], label: 'Sunny Day' },
  sunset: { sky: ['#4c1d95', '#b91c1c', '#f59e0b'], label: 'Sunset Sky' },
  rain: { sky: ['#1e293b', '#475569', '#64748b'], label: 'Stormy Rain' },
  snow: { sky: ['#0f172a', '#1e293b', '#cbd5e1'], label: 'Winter Snow' },
  night: { sky: ['#030712', '#0b1329', '#1c2541'], label: 'Midnight' },
  goldenhour: { sky: ['#7c2d12', '#ea580c', '#facc15'], label: 'Golden Hour' }
};

export function getSkyFlightDifficulty(difficulty: 'easy' | 'medium' | 'hard') {
  switch (difficulty) {
    case 'easy':
      return {
        baseSpeed: 5,
        speedIncrement: 0.1,
        obstacleSpacing: 400,
        scoreMultiplier: 1.0,
        powerupChance: 0.25,
        coinChance: 0.6,
        hazardChance: 0.4
      };
    case 'medium':
      return {
        baseSpeed: 7.5,
        speedIncrement: 0.18,
        obstacleSpacing: 300,
        scoreMultiplier: 1.5,
        powerupChance: 0.18,
        coinChance: 0.5,
        hazardChance: 0.6
      };
    case 'hard':
      return {
        baseSpeed: 10,
        speedIncrement: 0.25,
        obstacleSpacing: 220,
        scoreMultiplier: 2.5,
        powerupChance: 0.12,
        coinChance: 0.4,
        hazardChance: 0.8
      };
  }
}

export function generateSkyFlightLayout(seed: number, difficulty: 'easy' | 'medium' | 'hard'): SkyFlightConfig {
  const prng = new SeededRandom(seed);
  const diffConfig = getSkyFlightDifficulty(difficulty);
  
  const weathers: WeatherType[] = ['sunny', 'sunset', 'rain', 'snow', 'night', 'goldenhour'];
  const weather = prng.pick(weathers);
  
  return {
    weather,
    skyGradient: WEATHER_THEMES[weather].sky,
    ...diffConfig
  };
}

// Deterministically generate a chunk of obstacles & collectibles from seed and distance range
export function generateItemsForRange(
  seed: number,
  difficulty: 'easy' | 'medium' | 'hard',
  startDistance: number,
  endDistance: number
): { obstacles: ObstacleInstance[]; collectibles: CollectibleInstance[] } {
  // Use a hash of seed and chunk index to keep it fully deterministic per chunk
  const chunkIndex = Math.floor(startDistance / 2000);
  const chunkSeed = seed + chunkIndex * 37;
  const prng = new SeededRandom(chunkSeed);
  const diffConfig = getSkyFlightDifficulty(difficulty);

  const obstacles: ObstacleInstance[] = [];
  const collectibles: CollectibleInstance[] = [];

  const obstacleSpacing = diffConfig.obstacleSpacing;
  
  // Align start to spacing grid
  let currentDist = Math.ceil(startDistance / obstacleSpacing) * obstacleSpacing;

  const obstacleTypes: ObstacleType[] = ['bird', 'cloud', 'lightning', 'plane', 'balloon', 'windmill'];
  const powerupTypes: PowerupType[] = ['shield', 'slowmo', 'magnet', 'turbo', 'double'];

  while (currentDist < endDistance) {
    // Determine what to place at this distance row
    const rowRoll = prng.next();

    if (rowRoll < diffConfig.hazardChance) {
      // Generate obstacle(s)
      const obstacleCount = difficulty === 'hard' && prng.next() > 0.5 ? 2 : 1;
      const occupiedLanes = new Set<number>();

      for (let i = 0; i < obstacleCount; i++) {
        // Pick lane
        let lane = Math.floor(prng.range(0, 3));
        let tries = 0;
        while (occupiedLanes.has(lane) && tries < 10) {
          lane = Math.floor(prng.range(0, 3));
          tries++;
        }
        
        // Never block all 3 lanes entirely in a single row
        if (occupiedLanes.size >= 2) break;
        
        occupiedLanes.add(lane);

        const type = prng.pick(obstacleTypes);
        obstacles.push({
          id: `obs-${currentDist}-${lane}-${i}`,
          lane,
          type,
          distance: currentDist,
          width: 0.6, // Relative width inside the lane (0.0 to 1.0)
          height: 80  // Height in distance units
        });
      }

      // Fill remaining empty lanes occasionally with coins
      for (let lane = 0; lane < 3; lane++) {
        if (!occupiedLanes.has(lane) && prng.next() < diffConfig.coinChance) {
          collectibles.push({
            id: `coin-${currentDist}-${lane}`,
            lane,
            type: 'coin',
            distance: currentDist,
            width: 0.4,
            height: 40
          });
        }
      }
    } else {
      // Safe row: can place coins or powerups
      const laneRoll = prng.next();
      if (laneRoll < diffConfig.powerupChance) {
        // Place a powerup in a random lane
        const lane = Math.floor(prng.range(0, 3));
        const powerup = prng.pick(powerupTypes);
        collectibles.push({
          id: `powerup-${currentDist}-${lane}`,
          lane,
          type: powerup,
          distance: currentDist,
          width: 0.5,
          height: 50
        });
      } else if (laneRoll < diffConfig.powerupChance + diffConfig.coinChance) {
        // Place coins in pattern (e.g. 3 coins in a line)
        const lane = Math.floor(prng.range(0, 3));
        for (let j = 0; j < 3; j++) {
          const coinDist = currentDist + j * 60;
          if (coinDist < endDistance) {
            collectibles.push({
              id: `coin-${coinDist}-${lane}`,
              lane,
              type: 'coin',
              distance: coinDist,
              width: 0.4,
              height: 40
            });
          }
        }
      }
    }

    currentDist += obstacleSpacing;
  }

  return { obstacles, collectibles };
}
