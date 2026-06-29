export class SelectionGestureEngine {
  /**
   * Finds the closest cell under the pointer within a forgiving radius
   */
  static getClosestCell(
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    forgivingFactor = 0.85
  ): { r: number; c: number; distance: number } | null {
    const cellW = width / size
    const cellH = height / size
    
    let closestR = -1
    let closestC = -1
    let minDistance = Infinity
    
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const centerX = (c + 0.5) * cellW
        const centerY = (r + 0.5) * cellH
        const dist = Math.hypot(x - centerX, y - centerY)
        
        if (dist < minDistance) {
          minDistance = dist
          closestR = r
          closestC = c
        }
      }
    }
    
    const cellRadius = Math.max(cellW, cellH) * forgivingFactor
    if (minDistance <= cellRadius) {
      return { r: closestR, c: closestC, distance: minDistance }
    }
    
    return null
  }

  /**
   * Interpolates paths for fast drags to ensure no intermediate cells are skipped
   */
  static getInterpolatedPath(
    lastR: number,
    lastC: number,
    targetR: number,
    targetC: number
  ): [number, number][] {
    const cells: [number, number][] = []
    const dr = targetR - lastR
    const dc = targetC - lastC
    const steps = Math.max(Math.abs(dr), Math.abs(dc))
    
    if (steps <= 1) {
      return [[targetR, targetC]]
    }

    const isHorizontal = dr === 0
    const isVertical = dc === 0
    const isDiagonal = Math.abs(dr) === Math.abs(dc)

    if (isHorizontal || isVertical || isDiagonal) {
      const stepR = dr === 0 ? 0 : dr / steps
      const stepC = dc === 0 ? 0 : dc / steps
      for (let i = 1; i <= steps; i++) {
        cells.push([
          Math.round(lastR + stepR * i),
          Math.round(lastC + stepC * i)
        ])
      }
    } else {
      // Predictive/snapping fallback: if not aligned, interpolate along the dominant axis first
      const stepR = Math.sign(dr)
      const stepC = Math.sign(dc)
      let currR = lastR
      let currC = lastC
      
      while (currR !== targetR || currC !== targetC) {
        if (Math.abs(targetR - currR) > Math.abs(targetC - currC)) {
          currR += stepR
        } else {
          currC += stepC
        }
        cells.push([currR, currC])
      }
    }
    
    return cells
  }
}
