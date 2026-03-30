'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createChallenge, ChallengeMode } from '@/lib/challenges';

const DAY_OPTIONS = [7, 14, 21, 30];

export default function CreatePage() {
    const { user } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [totalDays, setTotalDays] = useState<number>(30);
    const [mode, setMode] = useState<ChallengeMode>('INDIVIDUAL');
    const [loading, setLoading] = useState(false);
    const [inviteUrl, setInviteUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !name.trim()) return;
        setLoading(true);
        try {
            const id = await createChallenge(name.trim(), totalDays, mode, user.uid);
            // Also join as participant
            const { joinChallenge } = await import('@/lib/challenges');
            await joinChallenge(id, user.uid, user.displayName ?? 'Creador');
            const url = `${window.location.origin}/join/${id}`;
            setInviteUrl(url);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (inviteUrl) {
        return (
            <div className="app-container">
                <header className="page-header">
                    <h1 className="page-title">¡Desafío Creado!</h1>
                </header>

                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
                    <p className="font-bold" style={{ fontSize: '1.125rem' }}>
                        {name}
                    </p>
                    <p className="text-muted text-sm mt-2">
                        {mode === 'TEAM' ? '👥 Modo Equipo' : '🧑 Modo Individual'} · {totalDays} días
                    </p>
                </div>

                <div className="mb-6">
                    <p className="text-muted text-sm mb-4">
                        Comparte este enlace con tus amigos:
                    </p>
                    <div className="invite-box">
                        <span className="invite-url">{inviteUrl}</span>
                        <button
                            className={`copy-btn ${copied ? 'copied' : ''}`}
                            onClick={handleCopy}
                        >
                            {copied ? '✓ Copiado' : 'Copiar'}
                        </button>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={() => router.push(`/challenge/${inviteUrl.split('/join/')[1]}`)}
                >
                    Ver mi desafío →
                </button>
            </div>
        );
    }

    return (
        <div className="app-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Crear Desafío</h1>
                    <p className="page-subtitle">Configura tu reto fitness</p>
                </div>
                <Link href="/" className="btn-ghost">
                    ← Volver
                </Link>
            </header>

            <form onSubmit={handleCreate}>
                <div className="form-group">
                    <label className="form-label">Nombre del desafío</label>
                    <input
                        id="challenge-name-input"
                        className="form-input"
                        placeholder="Ej: 30 días sin azúcar"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={60}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Duración</label>
                    <div className="days-selector">
                        {DAY_OPTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`day-option ${totalDays === d ? 'active' : ''}`}
                                onClick={() => setTotalDays(d)}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Modalidad</label>
                    <div className="mode-selector">
                        <button
                            type="button"
                            className={`mode-option ${mode === 'INDIVIDUAL' ? 'active' : ''}`}
                            onClick={() => setMode('INDIVIDUAL')}
                        >
                            <span className="mode-option-icon">🧑</span>
                            <span className="mode-option-label">Individual</span>
                            <span className="text-xs text-muted" style={{ lineHeight: 1.3 }}>
                                Cada uno mantiene su racha
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`mode-option ${mode === 'TEAM' ? 'active' : ''}`}
                            onClick={() => setMode('TEAM')}
                        >
                            <span className="mode-option-icon">👥</span>
                            <span className="mode-option-label">Equipo</span>
                            <span className="text-xs text-muted" style={{ lineHeight: 1.3 }}>
                                Todos dependen de todos
                            </span>
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 40 }}>
                    <button
                        id="create-btn"
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? <span className="spinner" /> : 'Crear y obtener enlace →'}
                    </button>
                </div>
            </form>
        </div>
    );
}
