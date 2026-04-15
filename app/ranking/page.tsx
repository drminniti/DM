'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getFirebaseDb } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import BottomNav from '@/components/BottomNav';
import type { UserProfile } from '@/lib/users';

export default function RankingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(50));
    
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => d.data() as UserProfile);
      setUsers(list);
      setFetching(false);
    });

    return () => unsub();
  }, [user]);

  if (loading || !user) return null;

  // Find current user's rank
  const myIndex = users.findIndex(u => u.uid === user.uid);
  const myRank = myIndex !== -1 ? myIndex + 1 : '—';
  const myPoints = myIndex !== -1 ? users[myIndex].points : 0;

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <header className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem' }}>Ranking Global 🏆</h1>
          <p className="page-subtitle">Compara tu puntaje con el resto</p>
        </div>
        <button 
          className="btn-ghost" 
          style={{ fontSize: '1.25rem', padding: '0 8px' }} 
          title="Cómo funcionan los puntos"
          onClick={() => setShowRules(true)}
        >
          ℹ️
        </button>
      </header>

      {fetching ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          <span className="spinner" />
        </div>
      ) : (
        <>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 0, 0, 0))',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '24px',
            border: '1px solid var(--color-accent-glow)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <p className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tu Posición</p>
              <p className="font-bold" style={{ fontSize: '1.5rem', color: 'var(--color-text)' }}>
                #{myRank}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="text-muted text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tus Puntos</p>
              <p className="font-bold text-accent" style={{ fontSize: '1.5rem' }}>
                {myPoints}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {users.map((u, index) => (
              <RankingRow key={u.uid} userProfile={u} rank={index + 1} isMe={u.uid === user.uid} />
            ))}
            
            {users.length === 0 && (
              <p className="text-muted text-center mt-8">Aún no hay usuarios en el ranking.</p>
            )}
          </div>
        </>
      )}

      {showRules && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24, backdropFilter: 'blur(5px)'
          }}
          onClick={() => setShowRules(false)}
        >
          <div 
            className="card" 
            style={{ width: '100%', maxWidth: 400, animation: 'pop 0.3s ease-out', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold mb-4" style={{ fontSize: '1.25rem' }}>¿Cómo sumo puntos?</h3>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, fontSize: '0.875rem' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✅ Día cumplido</span>
                <span className="text-accent font-bold">+5 pts</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🏁 Desafío 100% completado</span>
                <span className="text-accent font-bold">+30 pts</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🥉 Insignia 7 días</span>
                <span className="text-accent font-bold">+50 pts</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🥈 Insignia 21 días</span>
                <span className="text-accent font-bold">+150 pts</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🥇 Insignia 30 días</span>
                <span className="text-accent font-bold">+300 pts</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>☠️ Ganar Supervivencia</span>
                <span style={{ color: '#ffd700', fontWeight: 800 }}>+50 pts × rival</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-danger)' }}>
                <span>❌ Perder racha</span>
                <span className="font-bold">−10 pts</span>
              </li>
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => setShowRules(false)}>
                ¡Entendido!
              </button>
              <a href="/info" className="btn btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                Ver reglas completas 📖
              </a>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function RankingRow({ userProfile, rank, isMe }: { userProfile: UserProfile, rank: number, isMe: boolean }) {
  let rankStyle: React.CSSProperties = { color: 'var(--color-text-muted)' };
  let rankIcon = `#${rank}`;

  if (rank === 1) {
    rankStyle = { color: '#ffd700', textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' };
    rankIcon = '👑';
  } else if (rank === 2) {
    rankStyle = { color: '#c0c0c0' };
  } else if (rank === 3) {
    rankStyle = { color: '#cd7f32' };
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '16px',
      background: isMe ? 'var(--color-surface-2)' : 'var(--color-surface)',
      border: isMe ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      gap: 16
    }}>
      <div style={{ width: 30, textAlign: 'center', fontWeight: 800, fontSize: rank <= 3 ? '1.5rem' : '1.1rem', ...rankStyle }}>
        {rankIcon}
      </div>
      
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        overflow: 'hidden', border: '1px solid var(--color-border)'
      }}>
        {userProfile.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userProfile.photoURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            {(userProfile.displayName || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p className="font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {userProfile.displayName || 'Jugador Anónimo'}
          {isMe && <span className="text-accent text-xs" style={{ marginLeft: 8 }}>(Tú)</span>}
        </p>
        <p className="text-muted text-xs">Unido recientemente</p>
      </div>

      <div style={{ textAlign: 'right' }}>
        <p className="font-bold" style={{ fontSize: '1.25rem', color: rank <= 3 ? rankStyle.color : 'var(--color-text)' }}>
          {userProfile.points}
        </p>
        <p className="text-muted" style={{ fontSize: '0.65rem' }}>PTS</p>
      </div>
    </div>
  );
}
