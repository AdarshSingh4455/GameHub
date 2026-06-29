import React from 'react'

interface AssetProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

// Sleek neon fist vector representing Rock
export const RockVector: React.FC<AssetProps> = ({ size = 32, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 8px hsl(355 85% 55% / 0.5))', ...style }}
  >
    <defs>
      <linearGradient id="rock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(355 85% 55%)" />
        <stop offset="100%" stopColor="hsl(330 85% 45%)" />
      </linearGradient>
    </defs>
    {/* Clenched fist silhouette & inner paths */}
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      fill="url(#rock-grad)"
      fillOpacity="0.12"
      stroke="url(#rock-grad)"
      strokeWidth="1.5"
    />
    <path
      d="M12 17H14C15.1046 17 16 16.1046 16 15V13M7.5 12V9.5C7.5 8.67157 8.17157 8 9 8C9.82843 8 10.5 8.67157 10.5 9.5V11.5M10.5 11.5V9C10.5 8.17157 11.1716 7.5 12 7.5C12.8284 7.5 13.5 8.17157 13.5 9V11.5M13.5 11.5V9.5C13.5 8.67157 14.1716 8 15 8C15.8284 8 16.5 8.67157 16.5 9.5V12M7.5 12C6.67157 12 6 12.6716 6 13.5C6 14.3284 6.67157 15 7.5 15H11.5M7.5 12V15M11.5 17H7.5"
      stroke="url(#rock-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Sleek neon open hand vector representing Paper
export const PaperVector: React.FC<AssetProps> = ({ size = 32, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 8px hsl(220 100% 60% / 0.5))', ...style }}
  >
    <defs>
      <linearGradient id="paper-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(220 100% 60%)" />
        <stop offset="100%" stopColor="hsl(270 80% 60%)" />
      </linearGradient>
    </defs>
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      fill="url(#paper-grad)"
      fillOpacity="0.12"
      stroke="url(#paper-grad)"
      strokeWidth="1.5"
    />
    <path
      d="M18 11V6C18 5.44772 17.5523 5 17 5C16.4477 5 16 5.44772 16 6V11M14 10V4C14 3.44772 13.5523 3 13 3C12.4477 3 12 3.44772 12 4V11M10 11V5C10 4.44772 9.55228 4 9 4C8.44772 4 8 4.44772 8 5V11M6 13V8.5C6 7.94772 5.55228 7.5 5 7.5C4.44772 7.5 4 7.94772 4 8.5V16C4 18.7614 6.23858 21 9 21H12C14.7614 21 17 18.7614 17 16V13"
      stroke="url(#paper-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Sleek neon scissors vector representing Scissors
export const ScissorsVector: React.FC<AssetProps> = ({ size = 32, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 8px hsl(45 100% 55% / 0.5))', ...style }}
  >
    <defs>
      <linearGradient id="scissors-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(45 100% 55%)" />
        <stop offset="100%" stopColor="hsl(38 95% 50%)" />
      </linearGradient>
    </defs>
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      fill="url(#scissors-grad)"
      fillOpacity="0.12"
      stroke="url(#scissors-grad)"
      strokeWidth="1.5"
    />
    <path
      d="M6 9C7.65685 9 9 7.65685 9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9Z"
      stroke="url(#scissors-grad)"
      strokeWidth="2"
    />
    <path
      d="M6 21C7.65685 21 9 19.6569 9 18C9 16.3431 7.65685 15 6 15C4.34315 15 3 16.3431 3 18C3 19.6569 4.34315 21 6 21Z"
      stroke="url(#scissors-grad)"
      strokeWidth="2"
    />
    <path
      d="M8.12012 8.12012L20.0001 20M20.0001 4L8.12012 15.8799"
      stroke="url(#scissors-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
