'use client';

import { useState } from 'react';

interface ShareButtonProps {
  challengeName: string;
  streak: number;
  totalDays: number;
  currentDay: number;
  playerName: string;
  mode: 'TEAM' | 'INDIVIDUAL';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateShareImage(props: ShareButtonProps): Promise<Blob> {
  const { challengeName, streak, totalDays, currentDay, playerName, mode } = props;

  const SIZE = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // ── Background gradient ──────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(0.5, '#111827');
  bg.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Glow rings ───────────────────────────────────────────────
  const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, 500);
  glow.addColorStop(0, 'rgba(0, 230, 118, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Card background ──────────────────────────────────────────
  drawRoundedRect(ctx, 60, 60, SIZE - 120, SIZE - 120, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Top accent bar ───────────────────────────────────────────
  const accentGrad = ctx.createLinearGradient(60, 0, SIZE - 60, 0);
  accentGrad.addColorStop(0, '#00e676');
  accentGrad.addColorStop(1, '#00b0ff');
  drawRoundedRect(ctx, 60, 60, SIZE - 120, 6, 3);
  ctx.fillStyle = accentGrad;
  ctx.fill();

  // ── App name ─────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('DesafíosAPP', SIZE / 2, 175);

  // ── Challenge name ───────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  // Truncate if too long
  const maxWidth = SIZE - 200;
  let displayName = challengeName;
  while (ctx.measureText(displayName).width > maxWidth && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== challengeName) displayName += '…';
  ctx.fillText(displayName, SIZE / 2, 270);

  // ── Mode pill ────────────────────────────────────────────────
  const pillLabel = mode === 'TEAM' ? '👥 Desafío en Equipo' : '🧑 Desafío Individual';
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const pillW = ctx.measureText(pillLabel).width + 48;
  drawRoundedRect(ctx, (SIZE - pillW) / 2, 300, pillW, 48, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(pillLabel, SIZE / 2, 332);

  // ── BIG streak ───────────────────────────────────────────────
  // Fire emoji
  ctx.font = '160px serif';
  ctx.fillText('🔥', SIZE / 2, 560);

  // Streak number with glow effect
  ctx.shadowColor = '#00e676';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 220px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(String(streak), SIZE / 2, 780);
  ctx.shadowBlur = 0;

  // "días" label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(streak === 1 ? 'día seguido' : 'días seguidos', SIZE / 2, 855);

  // ── Progress bar ─────────────────────────────────────────────
  const barX = 120;
  const barY = 910;
  const barW = SIZE - 240;
  const barH = 16;
  const progressRatio = Math.min(currentDay / totalDays, 1);

  // Track
  drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  // Fill
  if (progressRatio > 0) {
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW * progressRatio, 0);
    fillGrad.addColorStop(0, '#00e676');
    fillGrad.addColorStop(1, '#00b0ff');
    drawRoundedRect(ctx, barX, barY, barW * progressRatio, barH, barH / 2);
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  // Progress label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Día ${currentDay}`, barX, barY + 52);
  ctx.textAlign = 'right';
  ctx.fillText(`de ${totalDays}`, barX + barW, barY + 52);
  ctx.textAlign = 'center';

  // ── Player name ──────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`— ${playerName}`, SIZE / 2, 1020);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.95);
  });
}

export default function ShareButton({
  challengeName,
  streak,
  totalDays,
  currentDay,
  playerName,
  mode,
}: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const blob = await generateShareImage({
        challengeName,
        streak,
        totalDays,
        currentDay,
        playerName,
        mode,
      });

      const file = new File([blob], `desafio-${streak}-dias.png`, { type: 'image/png' });

      const shareText = `🔥 ¡Llevo ${streak} ${streak === 1 ? 'día' : 'días'} seguidos en "${challengeName}"! ¿Te animás a sumarte? 💪`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Native share on mobile (WhatsApp, Instagram, etc.)
        await navigator.share({
          files: [file],
          text: shareText,
        });
      } else {
        // Desktop fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `racha-${streak}-dias.png`;
        a.click();
        URL.revokeObjectURL(url);
      }

      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      // User cancelled share — silently ignore
      if ((err as Error).name !== 'AbortError') console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        color: done ? 'var(--color-primary)' : 'rgba(255,255,255,0.8)',
        fontSize: '0.95rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}
    >
      {loading ? (
        <span className="spinner" style={{ width: 18, height: 18 }} />
      ) : done ? (
        <span style={{ fontSize: '1.1rem' }}>✓</span>
      ) : (
        <span style={{ fontSize: '1.1rem' }}>📲</span>
      )}
      {loading ? 'Generando imagen...' : done ? '¡Listo!' : 'Compartir mi racha'}
    </button>
  );
}
