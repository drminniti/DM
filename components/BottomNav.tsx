'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Spacer to prevent content from hiding behind the fixed nav */}
      <div style={{ height: 80 }} />

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 70,
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}
      >
        <NavItem href="/" icon="🏠" label="Desafíos" active={pathname === '/'} />
        <NavItem href="/ranking" icon="🏆" label="Ranking" active={pathname === '/ranking'} />
        <NavItem href="/info" icon="📖" label="Reglas" active={pathname === '/info'} />
        <NavItem href="/profile" icon="👤" label="Perfil" active={pathname === '/profile'} />
      </nav>
    </>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        opacity: active ? 1 : 0.6,
        textDecoration: 'none',
        flex: 1,
        padding: '8px 0',
      }}
    >
      <span style={{ fontSize: '1.25rem', filter: active ? 'none' : 'grayscale(100%)' }}>{icon}</span>
      <span style={{ fontSize: '0.65rem', fontWeight: active ? 700 : 500, letterSpacing: '0.05em' }}>{label}</span>
    </Link>
  );
}
