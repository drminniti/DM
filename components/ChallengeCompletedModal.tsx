'use client';

import { useEffect, useRef, useState } from 'react';

interface ChallengeCompletedModalProps {
  show: boolean;
  onClose: () => void;
  challengeName: string;
}

const EMOJIS = ['🌟', '🏆', '🎉', '🔥', '🙌', '💯', '🎊'];

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
}

export default function ChallengeCompletedModal({ show, onClose, challengeName }: ChallengeCompletedModalProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (show) {
      // Launch a massive burst of confetti!
      const newParticles: Particle[] = Array.from({ length: 80 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 14;
        return {
          id: i,
          emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          x: 50,
          y: 50,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 5,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 20,
          scale: 0.8 + Math.random() * 1.5,
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
            x: p.x + p.vx * 0.4,
            y: p.y + p.vy * 0.4,
            vy: p.vy + 0.3, // apply gravity
            rotation: p.rotation + p.rotationSpeed,
          }))
          .filter((p) => p.y < 120 && p.x > -20 && p.x < 120); // keep in bounds roughly

        setParticles([...particlesRef.current]);

        if (particlesRef.current.length > 0 && frame < 300) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      setParticles([]);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.4s ease-out forwards'
    }}>
      {/* Particle field */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {particles.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.scale * 1.5}rem`,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
              userSelect: 'none',
              willChange: 'transform',
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="card" style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 360,
        width: '90%',
        textAlign: 'center',
        background: 'var(--color-surface)',
        borderColor: 'var(--color-accent)',
        animation: 'celebPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        padding: '40px 24px',
        boxShadow: '0 20px 40px rgba(0,230,118, 0.15)'
      }}>
        <div style={{ fontSize: '4.5rem', marginBottom: 16 }}>🏆</div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-accent)', marginBottom: 12 }}>
          ¡Reto Completado!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 32 }}>
          Felicitaciones, han completado con éxito <strong>{challengeName}</strong>. ¡Qué racha increíble!
        </p>
        
        <button className="btn btn-primary btn-xl" onClick={onClose} style={{ width: '100%' }}>
          Festejar 🎉
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
