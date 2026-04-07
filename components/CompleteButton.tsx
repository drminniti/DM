'use client';

import { useState, useEffect, useRef } from 'react';
import { markDayComplete } from '@/lib/challenges';
import type { BadgeType } from '@/lib/users';

interface CompleteButtonProps {
  challengeId: string;
  participantId: string;
  timezone?: string;
  alreadyDone: boolean;
  playerName?: string;
  challengeName?: string;
  onComplete?: () => void;
}

const EMOJIS = ['🎉', '🔥', '⭐', '✨', '💪', '🏆', '🎊', '😤'];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
}

export default function CompleteButton({
  challengeId,
  participantId,
  timezone,
  alreadyDone,
  playerName,
  challengeName,
  onComplete,
}: CompleteButtonProps) {
  const [done, setDone] = useState(alreadyDone);
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [badgeEarned, setBadgeEarned] = useState<BadgeType | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Sync with parent: when the realtime listener confirms completion, update local state
  useEffect(() => {
    if (alreadyDone) setDone(true);
  }, [alreadyDone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const launchCelebration = () => {
    setCelebrating(true);
    setShowMessage(true);

    // Generate particles bursting from center
    const newParticles: Particle[] = Array.from({ length: 40 }, (_, i) => {
      const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 4 + Math.random() * 8;
      return {
        id: i,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        x: 50, // % of screen
        y: 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6, // upward bias
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        scale: 0.8 + Math.random() * 1.2,
        opacity: 1,
      };
    });

    particlesRef.current = newParticles;
    setParticles([...newParticles]);

    let frame = 0;
    const animate = () => {
      frame++;
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * 0.6,
          y: p.y + p.vy * 0.6,
          vy: p.vy + 0.4, // gravity
          rotation: p.rotation + p.rotationSpeed,
          opacity: Math.max(0, p.opacity - (frame > 30 ? 0.03 : 0)),
        }))
        .filter((p) => p.opacity > 0);

      setParticles([...particlesRef.current]);

      if (particlesRef.current.length > 0 && frame < 120) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCelebrating(false);
        setParticles([]);
        setTimeout(() => setShowMessage(false), 400);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const handleClick = async () => {
    if (done || loading) return;
    setLoading(true);
    try {
      const badge = await markDayComplete(challengeId, participantId, timezone);
      setDone(true);
      if (badge) {
        setBadgeEarned(badge);
        // auto-dismiss badge overlay after 4 seconds
        setTimeout(() => setBadgeEarned(null), 4000);
      }
      launchCelebration();
      onComplete?.();

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challengeId, 
          triggerParticipantId: participantId,
          completedByName: playerName,
          challengeName,
        }),
      });
    } catch (e) {
      console.error('markDayComplete error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Badge unlock overlay */}
      {badgeEarned && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.92)',
              border: '2px solid #ffd700',
              borderRadius: 24,
              padding: '32px 48px',
              textAlign: 'center',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 60px rgba(255,215,0,0.3)',
              animation: 'celebPop 400ms cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>
              {badgeEarned === '7_DAYS' ? '🥉' : badgeEarned === '21_DAYS' ? '🥈' : '🥇'}
            </div>
            <div style={{ color: '#ffd700', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
              ¡Nuevo Logro!
            </div>
            <div style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
              {badgeEarned === '7_DAYS' ? 'Víspera de Fuego' : badgeEarned === '21_DAYS' ? 'Fuego Creciente' : 'Fuego Eterno'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
              +{badgeEarned === '7_DAYS' ? 50 : badgeEarned === '21_DAYS' ? 150 : 300} puntos
            </div>
          </div>
        </div>
      )}

      {/* Particle overlay */}
      {celebrating && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {particles.map((p) => (
            <span
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                fontSize: `${p.scale * 1.8}rem`,
                transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
                opacity: p.opacity,
                userSelect: 'none',
                willChange: 'transform, opacity',
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Celebration message overlay */}
      {showMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            pointerEvents: 'none',
          }}
        >
          <div
            className="celebration-message"
            style={{
              background: 'rgba(0,0,0,0.85)',
              border: '2px solid var(--color-accent)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 48px',
              textAlign: 'center',
              backdropFilter: 'blur(12px)',
              animation: 'celebPop 400ms cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏆</div>
            <div
              style={{
                color: 'var(--color-accent)',
                fontSize: '1.5rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              ¡Lo lograste!
            </div>
            <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: 4 }}>
              Racha actualizada 🔥
            </div>
          </div>
        </div>
      )}

      {/* The button */}
      {done ? (
        <button className="btn btn-done btn-xl" disabled>
          <span style={{ fontSize: '1.5rem' }}>✓</span>
          ¡Cumplido hoy!
        </button>
      ) : (
        <button
          id="complete-btn"
          className="btn btn-primary btn-xl"
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              Marcar como Cumplido
            </>
          )}
        </button>
      )}
    </>
  );
}
