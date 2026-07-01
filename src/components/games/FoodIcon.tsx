import React, { useState } from 'react'

interface FoodIconProps {
  type: string
  className?: string
  style?: React.CSSProperties
  width?: number | string
  height?: number | string
}

// 70 food items mapped to high-quality emojis for the third-tier premium badge fallback
export const EMOJI_MAP: Record<string, string> = {
  // Breakfast
  egg: '🍳', pancake: '🥞', croissant: '🥐', toast: '🍞', juice: '🧃',
  coffee: '☕', waffle: '🧇', bacon: '🥓', sausage: '🌭', oatmeal: '🥣',
  muffin: '🧁', tea: '🍵', milk: '🥛', yogurt: '🥛',
  // Fast Food
  burger: '🍔', fries: '🍟', pizza: '🍕', taco: '🌮', pretzel: '🥨',
  donut: '🍩', cookie: '🍪', hotdog: '🌭', nuggets: '🍗', 'onion-rings': '🧅',
  sandwich: '🥪', milkshake: '🥤', popcorn: '🍿', soda: '🥤',
  // Fruits
  apple: '🍎', orange: '🍊', lemon: '🍋', watermelon: '🍉', strawberry: '🍓',
  banana: '🍌', grapes: '🍇', cherry: '🍒', peach: '🍑', pineapple: '🍍',
  mango: '🥭', blueberry: '🫐', kiwi: '🥝', pear: '🍐',
  // Desserts
  cake: '🍰', 'ice-cream': '🍨', cupcake: '🧁',
  pie: '🥧', chocolate: '🍫', pudding: '🍮', macaron: '🥮', candy: '🍬',
  lollipop: '🍭', brownie: '🥮', tart: '🥧', jelly: '🍮',
  // Asian Cuisine
  sushi: '🍣', dumplings: '🥟', ramen: '🍜', 'rice-bowl': '🍚', 'spring-roll': '🌯',
  tempura: '🍤', boba: '🧋', 'green-tea': '🍵', 'dim-sum': '🥟', bao: '🥟',
  wonton: '🥟', mochi: '🍡', skewer: '🍢', tofu: '⬜',
  salad: '🥗'
};

// Premium background colors for emoji badges matching their theme/difficulty
const BADGE_COLOR_MAP: Record<string, string> = {
  egg: '#fef08a', pancake: '#fed7aa', croissant: '#ffedd5', toast: '#ffedd5',
  juice: '#fed7aa', coffee: '#f5e0c9', waffle: '#fed7aa', bacon: '#fca5a5',
  sausage: '#fca5a5', oatmeal: '#e2e8f0', muffin: '#fbcfe8', tea: '#bbf7d0',
  milk: '#f1f5f9', yogurt: '#f8fafc', burger: '#fed7aa', fries: '#fef08a',
  pizza: '#fca5a5', taco: '#fde047', pretzel: '#fed7aa', donut: '#fbcfe8',
  cookie: '#fed7aa', hotdog: '#fca5a5', nuggets: '#fed7aa', 'onion-rings': '#fed7aa',
  sandwich: '#fed7aa', milkshake: '#fbcfe8', popcorn: '#fef08a', soda: '#bfdbfe',
  apple: '#fca5a5', orange: '#fed7aa', lemon: '#fef08a', watermelon: '#bbf7d0',
  strawberry: '#fca5a5', banana: '#fef08a', grapes: '#e9d5ff', cherry: '#fca5a5',
  peach: '#fed7aa', pineapple: '#fde047', mango: '#fed7aa', blueberry: '#bfdbfe',
  kiwi: '#bbf7d0', pear: '#bbf7d0', cake: '#fbcfe8', 'ice-cream': '#fbcfe8',
  cupcake: '#fbcfe8', pie: '#fed7aa', chocolate: '#d97706', pudding: '#fef08a',
  macaron: '#fbcfe8', candy: '#fca5a5', lollipop: '#fbcfe8', brownie: '#78350f',
  tart: '#fed7aa', jelly: '#fbcfe8', sushi: '#fca5a5', dumplings: '#fef08a',
  ramen: '#fed7aa', 'rice-bowl': '#e2e8f0', 'spring-roll': '#fed7aa', tempura: '#fed7aa',
  boba: '#fed7aa', 'green-tea': '#bbf7d0', 'dim-sum': '#fef08a', bao: '#f8fafc',
  wonton: '#fed7aa', mochi: '#fbcfe8', skewer: '#fed7aa', tofu: '#f8fafc',
  salad: '#bbf7d0'
};

// Premium second-tier custom inline vector SVGs for new items
const INLINE_SVGS: Record<string, React.ReactNode> = {
  coffee: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <rect x="16" y="24" width="32" height="28" rx="8" fill="#a855f7" />
      <path d="M48 28C53 28 56 31 56 35C56 39 53 42 48 42" stroke="#a855f7" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="32" cy="24" rx="16" ry="4" fill="#6b21a8" />
      <ellipse cx="32" cy="24" rx="12" ry="2.5" fill="#78350f" />
      <path d="M26 14Q28 10 30 14" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 14Q36 10 38 14" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  toast: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <path d="M12 24C12 16 18 12 32 12C46 12 52 16 52 24V48C52 52 48 56 44 56H20C16 56 12 52 12 48V24Z" fill="#b45309" />
      <path d="M16 26C16 19 20 16 32 16C44 16 48 19 48 26V46C48 49 46 52 42 52H22C18 52 16 49 16 46V26Z" fill="#fef3c7" />
      <rect x="22" y="28" width="12" height="10" rx="2" fill="#fbbf24" opacity="0.8" />
    </svg>
  ),
  juice: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <rect x="18" y="20" width="28" height="34" rx="4" fill="#f97316" />
      <path d="M28 20L34 10" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="36" r="8" fill="#fff" opacity="0.3" />
      <path d="M32 32L32 40M28 36L36 36" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  soda: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <rect x="18" y="16" width="28" height="38" rx="6" fill="#3b82f6" />
      <rect x="22" y="12" width="20" height="4" rx="2" fill="#cbd5e1" />
      <path d="M18 26H46V36H18V26Z" fill="#ef4444" />
      <path d="M26 22L38 48" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  dumplings: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <path d="M12 40C12 40 14 24 32 24C50 24 52 40 52 40C52 45 44 48 32 48C20 48 12 45 12 40Z" fill="#f1f5f9" />
      <path d="M12 40C16 38 20 38 24 40C28 38 32 38 36 40C40 38 44 38 48 40" stroke="#e2e8f0" strokeWidth="2.5" />
      <ellipse cx="32" cy="45" rx="16" ry="3" fill="#cbd5e1" opacity="0.5" />
    </svg>
  ),
  ramen: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <path d="M12 28C12 28 14 52 32 52C50 52 52 28 52 28H12Z" fill="#ef4444" />
      <path d="M10 28H54" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 28Q20 22 24 28Q28 22 32 28Q36 22 40 28Q44 22 48 28" stroke="#fef08a" strokeWidth="3" fill="none" />
      <path d="M8 20L48 16M12 16L52 12" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  boba: (
    <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
      <path d="M20 16H44L40 50H24L20 16Z" fill="#fff" opacity="0.3" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M22 24H42L40 50H24L22 24Z" fill="#f59e0b" opacity="0.6" />
      <circle cx="28" cy="42" r="3" fill="#000" />
      <circle cx="36" cy="44" r="3" fill="#000" />
      <circle cx="32" cy="36" r="3" fill="#000" />
      <path d="M30 8V52" stroke="#ec4899" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
};

export default function FoodIcon({ type, className, style, width = '100%', height = '100%' }: FoodIconProps) {
  const [hasError, setHasError] = useState(false);
  const src = `/assets/games/memory-plate/foods/${type}.svg`;

  if (hasError) {
    // 2nd Tier: check if we have a premium inline vector SVG
    if (INLINE_SVGS[type]) {
      return (
        <div
          className={className}
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style
          }}
        >
          {INLINE_SVGS[type]}
        </div>
      );
    }

    // 3rd Tier: Fall back to beautiful styled Emoji Badge
    const emoji = EMOJI_MAP[type] || '🍲';
    const bg = BADGE_COLOR_MAP[type] || '#e2e8f0';

    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${bg} 70%, #94a3b8 100%)`,
          borderRadius: '50%',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 6px rgba(0,0,0,0.15)',
          fontSize: '1.8rem',
          pointerEvents: 'none',
          userSelect: 'none',
          border: '1.5px solid rgba(255,255,255,0.4)',
          position: 'relative',
          overflow: 'hidden',
          ...style
        }}
      >
        {/* Gloss overlay highlight */}
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: '15%',
            width: '70%',
            height: '35%',
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
            borderRadius: '50% 50% 40% 40%'
          }}
        />
        <span>{emoji}</span>
      </div>
    );
  }

  // 1st Tier: Attempt to load local SVG file asset
  return (
    <img
      src={src}
      alt={type}
      className={className}
      onError={() => setHasError(true)}
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
  );
}
