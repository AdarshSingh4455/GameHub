'use client'

import React from 'react'

interface SectionProps {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

export default function Section({ title, action, children, className = '', style, id }: SectionProps) {
  return (
    <section id={id} className={`w-full flex flex-col gap-3 md:gap-4 ${className}`} style={style}>
      {(title || action) && (
        <div className="flex justify-between items-center w-full px-1">
          {title && (
            <h3 className="text-xs md:text-sm font-extrabold uppercase tracking-widest text-[hsl(var(--text-secondary))]">
              {title}
            </h3>
          )}
          {action && <div className="flex items-center">{action}</div>}
        </div>
      )}
      <div className="w-full flex flex-col gap-3 md:gap-4">
        {children}
      </div>
    </section>
  )
}
