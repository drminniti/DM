'use client';

import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      marginBottom: 32,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
        {title}
      </p>
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
);

const Row = ({ icon, label, value, sub, valueColor }: { icon: string; label: string; value: string; sub?: string; valueColor?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
    <span style={{ fontSize: '1.4rem', width: 32, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{label}</p>
      {sub && <p className="text-muted text-xs" style={{ marginTop: 2 }}>{sub}</p>}
    </div>
    <span style={{ fontWeight: 800, fontSize: '1rem', color: valueColor ?? 'var(--color-accent)', whiteSpace: 'nowrap' }}>
      {value}
    </span>
  </div>
);

export default function InfoPage() {
  return (
    <div className="app-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Cómo funciona</h1>
          <p className="page-subtitle">Modos de juego y sistema de puntos</p>
        </div>
      </header>

      {/* ---- MODOS ---- */}
      <Section title="Modos de desafío">
        {/* Individual */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>🧑</span>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>Individual</p>
          </div>
          <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <li>🎯 Cada jugador corre su propio desafío de forma independiente.</li>
            <li>🔄 Si fallás un día, tu racha se reinicia a 0 pero <strong style={{ color: 'var(--color-text)' }}>seguís en el desafío</strong>.</li>
            <li>📅 El desafío termina cuando se agotan los días del calendario.</li>
            <li>🏆 Al final se muestra si lo superaste, casi llegaste, o no alcanzaste.</li>
            <li>🎁 Completar el 100% de los días da un <strong style={{ color: 'var(--color-accent)' }}>bonus extra de +30 pts</strong>.</li>
          </ul>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

        {/* Equipo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>Equipo</p>
          </div>
          <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <li>🤝 Todos los jugadores comparten una única racha colectiva.</li>
            <li>⚠️ Si <strong style={{ color: 'var(--color-danger)' }}>uno solo falla</strong>, la racha de <strong style={{ color: 'var(--color-danger)' }}>todos</strong> se reinicia a 0.</li>
            <li>📅 El desafío termina cuando se agotan los días del calendario.</li>
            <li>💬 La coordinación del grupo es clave para llegar al final.</li>
          </ul>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

        {/* Supervivencia */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>☠️</span>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#ff3b30' }}>Supervivencia</p>
          </div>
          <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <li>💀 Si fallas un día, quedás <strong style={{ color: 'var(--color-danger)' }}>eliminado permanentemente</strong>.</li>
            <li>🏆 El último jugador en pie se lleva el <strong style={{ color: '#ffd700' }}>pozo completo</strong>.</li>
            <li>👥 Necesita al menos <strong style={{ color: 'var(--color-text)' }}>2 jugadores</strong> para comenzar.</li>
            <li>💰 Premio: <strong style={{ color: 'var(--color-accent)' }}>50 pts</strong> por cada rival eliminado + la insignia exclusiva de Superviviente.</li>
          </ul>
        </div>
      </Section>

      {/* ---- PUNTOS ---- */}
      <Section title="Sistema de puntos">
        <div style={{ marginBottom: 4 }}>
          <Row icon="✅" label="Día cumplido" value="+5 pts" sub="Cada vez que marcás el día como completado" />
          <Row icon="🏁" label="Desafío 100% completado" value="+30 pts" sub="Bonus por cumplir todos los días sin excepción" />
          <Row icon="🥉" label="Insignia — 7 días de racha" value="+50 pts" sub="Se acumula si la ganás varias veces" />
          <Row icon="🥈" label="Insignia — 21 días de racha" value="+150 pts" sub="Se acumula si la ganás varias veces" />
          <Row icon="🥇" label="Insignia — 30 días de racha" value="+300 pts" sub="Se acumula si la ganás varias veces" />
          <Row icon="☠️" label="Ganar Supervivencia" value="+50 pts × rival" sub="Multiplicado por la cantidad de jugadores eliminados" valueColor="#ffd700" />
          <Row icon="❌" label="Perder la racha" value="−10 pts" sub="Se descuenta cuando faltás un día (mínimo 0 pts)" valueColor="var(--color-danger)" />
        </div>
        <p className="text-muted text-xs" style={{ marginTop: 16, lineHeight: 1.6 }}>
          Los puntos son globales y se reflejan en el ranking independientemente del desafío.
          No podés bajar de 0 pts.
        </p>
      </Section>

      {/* ---- INSIGNIAS ---- */}
      <Section title="Insignias">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
          {[
            { icon: '🥉', name: 'Víspera de Fuego', desc: 'Alcanzá una racha de 7 días consecutivos.' },
            { icon: '🥈', name: 'Fuego Creciente', desc: 'Alcanzá una racha de 21 días consecutivos.' },
            { icon: '🥇', name: 'Fuego Eterno', desc: 'Alcanzá una racha de 30 días consecutivos.' },
            { icon: '💀', name: 'Superviviente', desc: 'Sé el último en pie en un desafío de Supervivencia.' },
          ].map((b) => (
            <div key={b.name} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>{b.icon}</span>
              <div>
                <p style={{ fontWeight: 700 }}>{b.name}</p>
                <p className="text-muted text-xs" style={{ marginTop: 3 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <Link href="/ranking" className="btn btn-secondary" style={{ display: 'inline-flex' }}>
          Ver Ranking Global 🏆
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
