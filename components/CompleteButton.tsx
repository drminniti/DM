'use client';

import { useState } from 'react';
import { markDayComplete } from '@/lib/challenges';

interface CompleteButtonProps {
    challengeId: string;
    participantId: string;
    alreadyDone: boolean;
    onComplete?: () => void;
}

export default function CompleteButton({
    challengeId,
    participantId,
    alreadyDone,
    onComplete,
}: CompleteButtonProps) {
    const [done, setDone] = useState(alreadyDone);
    const [loading, setLoading] = useState(false);
    const [justCompleted, setJustCompleted] = useState(false);

    const handleClick = async () => {
        if (done || loading) return;
        setLoading(true);
        try {
            await markDayComplete(challengeId, participantId);
            setDone(true);
            setJustCompleted(true);
            onComplete?.();

            // Notify other participants via API
            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId }),
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <button
                className={`btn btn-done btn-xl ${justCompleted ? 'check-anim' : ''}`}
                disabled
            >
                <span style={{ fontSize: '1.5rem' }}>✓</span>
                ¡Cumplido hoy!
            </button>
        );
    }

    return (
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
    );
}
