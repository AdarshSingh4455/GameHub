import React from 'react'

interface FoodIconProps {
  type: string
  className?: string
  style?: React.CSSProperties
  width?: number | string
  height?: number | string
}

export default function FoodIcon({ type, className, style, width = '100%', height = '100%' }: FoodIconProps) {
  const src = `/assets/games/memory-plate/foods/${type}.svg`
  
  return (
    <img
      src={src}
      alt={type}
      className={className}
      style={{
        width,
        height,
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style
      }}
      draggable={false}
    />
  )
}
