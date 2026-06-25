'use client'

import React from 'react'
import Card from './Card'

interface StatCardProps {
  label: string
  value: string | number
  icon?: string | React.ReactNode
  subtext?: string
  color?: string
  id?: string
}

export default function StatCard({ label, value, icon, subtext, color = 'hsl(var(--brand-primary))', id }: StatCardProps) {
  return (
    <Card id={id} className="relative overflow-hidden flex flex-col gap-1 min-w-0" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex justify-between items-center w-full">
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">{label}</span>
        {icon && <span className="text-lg md:text-xl">{icon}</span>}
      </div>
      <div className="text-xl md:text-2xl font-black text-white leading-tight truncate">{value}</div>
      {subtext && <span className="text-[9px] md:text-[10px] text-[hsl(var(--text-muted))] truncate">{subtext}</span>}
    </Card>
  )
}
