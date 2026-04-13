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
    const [customMode, setCustomMode] = useState(false);
    const [customInput, setCustomInput] = useState('');

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
                        {mode === 'TEAM' ? '👥 Modo Equipo' : mode === 'SURVIVAL' ? '☠️ Supervivencia' : '🧑 Modo Individual'} · {totalDays} días
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

                    {/* Preset chips */}
                    <div className="days-selector" style={{ marginBottom: 12 }}>
                        {DAY_OPTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                className={`day-option ${totalDays === d && !customMode ? 'active' : ''}`}
                                onClick={() => { setCustomMode(false); setTotalDays(d); }}
                            >
                                {d}d
                            </button>
                        ))}
                        <button
                            type="button"
                            className={`day-option ${customMode ? 'active' : ''}`}
                            onClick={() => { setCustomMode(true); setCustomInput(String(totalDays)); }}
                            style={{ minWidth: 80, fontSize: '0.8rem' }}
                        >
                            ✏️ Custom
                        </button>
                    </div>

                    {/* Custom input */}
                    {customMode && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input
                                type="number"
                                className="form-input"
                                min={1}
                                max={365}
                                value={customInput}
                                onChange={(e) => {
                                    setCustomInput(e.target.value);
                                    const v = parseInt(e.target.value);
                                    if (!isNaN(v) && v >= 1 && v <= 365) setTotalDays(v);
                                }}
                                placeholder="Ingresá los días (1–365)"
                                style={{ flex: 1 }}
                                autoFocus
                            />
                            <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>días</span>
                        </div>
                    )}

                    {/* Trophy hint */}
                    <p className="text-muted text-xs" style={{ marginTop: 10, lineHeight: 1.5 }}>
                        🏆 Trofeos a los <strong>7</strong>, <strong>21</strong> y <strong>30</strong> días de racha — sin importar la duración del desafío.
                    </p>
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
                                Todos mantienen su ritmo
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`mode-option ${mode === 'SURVIVAL' ? 'active' : ''}`}
                            onClick={() => setMode('SURVIVAL')}
                            style={{ 
                                borderColor: mode === 'SURVIVAL' ? '#ff3b30' : undefined,
                                background: mode === 'SURVIVAL' ? 'rgba(255, 59, 48, 0.1)' : undefined
                            }}
                        >
                            <span className="mode-option-icon" style={{ filter: mode === 'SURVIVAL' ? 'none' : 'grayscale(1)' }}>☠️</span>
                            <span className="mode-option-label" style={{ color: mode === 'SURVIVAL' ? '#ff3b30' : undefined }}>Supervivencia</span>
                            <span className="text-xs text-muted" style={{ lineHeight: 1.3 }}>
                                Fallar = Eliminado
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
                    {mode === 'SURVIVAL' && (
                        <p className="text-xs mt-3" style={{ color: '#ff3b30', lineHeight: 1.4, padding: '8px 12px', background: 'rgba(255, 59, 48, 0.1)', borderRadius: 8 }}>
                            ⚠️ <strong>Atención:</strong> Entrar cuesta <strong>20 PTS</strong> que van a un pozo acumulado. El último sobreviviente se lleva el pozo entero y la insignia exclusiva.
                        </p>
                    )}
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
