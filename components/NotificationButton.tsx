'use client';

import { useState, useEffect } from 'react';
import { requestNotificationPermission, getCurrentFcmToken } from '@/lib/notifications';
import { updateParticipantFcmToken } from '@/lib/challenges';

interface NotificationButtonProps {
  participantId: string;
}

export default function NotificationButton({ participantId }: NotificationButtonProps) {
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied' | 'loading'>('unknown');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) { setStatus('denied'); return; }
    if (Notification.permission === 'granted') setStatus('granted');
    else if (Notification.permission === 'denied') setStatus('denied');
  }, []);

  const handleEnable = async () => {
    setStatus('loading');
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await updateParticipantFcmToken(participantId, token);
        setStatus('granted');
      } else {
        setStatus('denied');
      }
    } catch {
      setStatus('denied');
    }
  };

  // Auto-save token if already granted (e.g. reinstall)
  useEffect(() => {
    if (status !== 'granted' || !participantId) return;
    getCurrentFcmToken().then((token) => {
      if (token) updateParticipantFcmToken(participantId, token);
    });
  }, [status, participantId]);

  if (status === 'granted') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-accent)',
          fontSize: '0.8rem',
          padding: '8px 0',
        }}
      >
        <span>🔔</span> Notificaciones activas
      </div>
    );
  }

  if (status === 'denied') return null; // browser denied — don't nag

  return (
    <button
      className="btn btn-secondary"
      style={{ minHeight: 44, fontSize: '0.875rem', gap: 8 }}
      onClick={handleEnable}
      disabled={status === 'loading'}
    >
      {status === 'loading' ? (
        <span className="spinner" />
      ) : (
        <>🔔 Activar notificaciones</>
      )}
    </button>
  );
}
