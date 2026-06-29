import React from 'react'

interface HeaderButtonProps {
  onClick: () => void
  icon: React.ReactNode
  label?: string
  title: string
  isActive?: boolean
  id?: string
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  onClick,
  icon,
  label,
  title,
  isActive = false,
  id,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: isActive ? 'hsl(220 100% 60% / 0.15)' : 'hsl(220 20% 16%)',
        border: isActive ? '1px solid hsl(220 100% 60%)' : '1px solid hsl(220 15% 24%)',
        color: isActive ? 'hsl(220 100% 70%)' : 'white',
        fontSize: '0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
        padding: '0.35rem 0.75rem',
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        height: '32px',
        minWidth: label ? 'auto' : '32px',
        transition: 'all 0.15s ease',
        boxSizing: 'border-box',
        boxShadow: isActive ? '0 0 10px hsl(220 100% 60% / 0.3)' : 'none',
      }}
      title={title}
      aria-label={title}
      id={id}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'hsl(220 20% 22%)'
        if (!isActive) e.currentTarget.style.borderColor = 'hsl(220 100% 60% / 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'hsl(220 100% 60% / 0.15)' : 'hsl(220 20% 16%)'
        e.currentTarget.style.borderColor = isActive ? 'hsl(220 100% 60%)' : 'hsl(220 15% 24%)'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

export default HeaderButton
