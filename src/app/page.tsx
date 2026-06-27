import Link from 'next/link'
import type { Metadata } from 'next'
import GameIcon from '@/components/games/GameIcon'

export const metadata: Metadata = {
  title: 'GameHub — Play Together, Compete, Win',
}

const FEATURED_GAMES = [
  { slug: 'cricket',       name: 'Hand Cricket',   emoji: '🏏', badge: 'Live',    desc: 'Real-time number battles' },
  { slug: 'scribble',      name: 'Scribble',        emoji: '🎨', badge: 'Hot',     desc: 'Draw & guess with friends' },
  { slug: 'dumb-charades', name: 'Dumb Charades',   emoji: '🎭', badge: 'Parties', desc: 'Describe without words' },
  { slug: 'whos-spy',      name: "Who's Spy",       emoji: '🕵️', badge: 'Social',  desc: 'Find the spy among you' },
  { slug: 'tic-tac-toe',   name: 'Tic-Tac-Toe',    emoji: '⭕', badge: 'Classic', desc: 'Noughts & crosses ranked' },
  { slug: '2048',          name: '2048',             emoji: '🔢', badge: 'Puzzle',  desc: 'Merge your way to 2048' },
]

const STATS = [
  { value: '12+',  label: 'Games' },
  { value: '∞',    label: 'Players' },
  { value: '0₹',   label: 'To Play' },
  { value: '24/7', label: 'Online' },
]

export default function HomePage() {
  return (
    <main style={{ minHeight: '100vh', background: 'hsl(222 20% 10%)' }}>
      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(1rem, 4vw, 2rem)',
        height: '60px',
        background: 'hsl(222 20% 10% / 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid hsl(220 15% 20%)',
      }}>
        <span style={{ fontWeight: 800, fontSize: '1.3rem', background: 'linear-gradient(135deg,hsl(220 100% 70%),hsl(270 80% 70%))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          🎮 GameHub
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/login"    className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 'clamp(6rem, 15vw, 10rem)', paddingBottom: '5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: 'hsl(220 100% 60% / 0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: 300, height: 300, borderRadius: '50%', background: 'hsl(270 80% 60% / 0.08)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div className="container animate-slideUp">
          <div style={{ marginBottom: '1rem' }}>
            <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '0.3rem 0.9rem' }}>
              ✨ Free to play · No download required
            </span>
          </div>

          <h1 className="text-display gradient-text" style={{ marginBottom: '1.25rem' }}>
            Play Together,<br />Compete, Win
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: 'hsl(220 10% 65%)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Real-time multiplayer games with leaderboards, XP, achievements, and a growing community.
            No login needed to play — just jump in.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              🚀 Play Now — It&apos;s Free
            </Link>
            <Link href="/register" className="btn btn-secondary btn-lg">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ paddingBlock: '3rem', borderTop: '1px solid hsl(220 15% 18%)', borderBottom: '1px solid hsl(220 15% 18%)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          {STATS.map((s) => (
            <div key={s.label} className="animate-slideUp">
              <div style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800 }} className="gradient-text">{s.value}</div>
              <div style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Games ── */}
      <section style={{ paddingBlock: '5rem' }}>
        <div className="container">
          <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
            <h2 className="text-hero" style={{ marginBottom: '0.5rem' }}>Featured Games</h2>
            <p style={{ color: 'hsl(220 10% 55%)' }}>Twelve games and counting. All free. All fun.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }} className="stagger">
            {FEATURED_GAMES.map((game) => (
              <Link
                key={game.slug}
                href={`/dashboard/games/${game.slug}`}
                className="card card-hover animate-slideUp"
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, hsl(222 20% 14%), hsl(222 20% 10%))',
                    border: '1px solid hsl(220 15% 20%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    <GameIcon slug={game.slug} size={44} />
                  </div>
                  <span className="badge badge-blue">{game.badge}</span>
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'hsl(220 15% 95%)', marginBottom: '0.25rem' }}>{game.name}</h3>
                  <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem' }}>{game.desc}</p>
                </div>
                <div style={{ marginTop: 'auto', color: 'hsl(220 100% 65%)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Play now →
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link href="/dashboard" className="btn btn-secondary">
              View All Games
            </Link>
          </div>
        </div>
      </section>

      {/* ── XP / Social CTA ── */}
      <section style={{ paddingBlock: '5rem', background: 'hsl(222 18% 13%)' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {[
            { icon: '🏆', title: 'Climb the Leaderboard', desc: 'Every win earns XP. Level up and dominate the global leaderboard.' },
            { icon: '🎯', title: 'Unlock Achievements', desc: 'Complete challenges and earn badges that show off your skills.' },
            { icon: '👥', title: 'Play With Friends', desc: 'Create a room, share the code, and let the battle begin.' },
          ].map((item) => (
            <div key={item.title} className="card animate-slideUp" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{item.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '0.5rem' }}>{item.title}</h3>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ paddingBlock: '5rem', textAlign: 'center' }}>
        <div className="container animate-slideUp">
          <h2 className="text-hero gradient-text" style={{ marginBottom: '1rem' }}>Ready to play?</h2>
          <p style={{ color: 'hsl(220 10% 55%)', marginBottom: '2rem' }}>No sign-up required. Jump straight into the action.</p>
          <Link href="/dashboard" className="btn btn-primary btn-lg animate-pulse-glow">
            🎮 Enter GameHub
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid hsl(220 15% 18%)', padding: '1.5rem', textAlign: 'center', color: 'hsl(220 10% 40%)', fontSize: '0.8rem' }}>
        © 2025 GameHub · Made with ❤️ · Free to play forever
      </footer>
    </main>
  )
}
