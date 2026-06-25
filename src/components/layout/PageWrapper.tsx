'use client'

import React from 'react'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

export default function PageWrapper({ children, className = '', style, id }: PageWrapperProps) {
  return (
    <div
      id={id}
      className={`w-full min-w-0 px-4 py-4 md:py-6 flex flex-col gap-4 md:gap-6 ${className}`}
      style={{
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  )
}
