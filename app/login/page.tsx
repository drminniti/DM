'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type Platform = 'ios' | 'android' | 'desktop' | 'installed';

function detectPlatform(): Platform {
    if (typeof window === 'undefined') return 'desktop';
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return 'installed';
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'desktop';
}

export default function LoginPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [platform, setPlatform] = useState<Platform>('desktop');
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!loading && user) router.replace('/');
    }, [user, loading, router]);

    useEffect(() => {
        const p = detectPlatform();
        setPlatform(p);
        const dismissed = localStorage.getItem('install_banner_dismissed');
        if (p !== 'installed' && p !== 'desktop' && !dismissed) {
            setShowBanner(true);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('install_banner_dismissed', '1');
        setShowBanner(false);
    };

    return (
        <div
            className="app-container"
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100dvh',
                textAlign: 'center',
                gap: 0,
            }}
        >
            <div style={{ width: '100%', maxWidth: 360 }}>
                {/* Logo */}
                <div style={{ fontSize: '4rem', marginBottom: 16 }}>🏋️</div>
                <h1 className="page-title" style={{ marginBottom: 8 }}>
                    DesafiosAPP
                </h1>
                <p className="text-muted" style={{ marginBottom: 40, fontSize: '1rem' }}>
                    Crea retos fitness, invita amigos
                    <br />y mantén tu racha activa.
                </p>

                {/* Install Banner */}
                {showBanner && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(0,230,118,0.08), rgba(0,176,255,0.06))',
                        border: '1px solid rgba(0,230,118,0.25)',
                        borderRadius: 20,
                        padding: '20px 20px 16px',
                        marginBottom: 28,
                        textAlign: 'left',
                        position: 'relative',
                    }}>
                        <button
                            onClick={handleDismiss}
                            style={{
                                position: 'absolute', top: 12, right: 14,
                                background: 'none', border: 'none',
                                color: 'var(--color-text-muted)', fontSize: '1.1rem',
                                cursor: 'pointer', lineHeight: 1,
                            }}
                        >✕</button>

                        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 8 }}>
                            📲 Instalá la app
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: 14 }}>
                            {platform === 'ios'
                                ? 'Para usarla como app nativa en iPhone:'
                                : 'Para usarla como app nativa en Android:'}
                        </p>

                        {platform === 'ios' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <InstallStep n={1} icon="🧭" text='Abrí esta página en <strong>Safari</strong> (no Chrome)' />
                                <InstallStep n={2} icon="⬆️" text='Tocá el botón <strong>Compartir</strong> (cuadrado con flecha ↑)' />
                                <InstallStep n={3} icon="➕" text='Seleccioná <strong>"Agregar a pantalla de inicio"</strong>' />
                                <InstallStep n={4} icon="✅" text='Tocá <strong>Agregar</strong> — ¡ya tenés el ícono!' />
                            </div>
                        )}

                        {platform === 'android' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <InstallStep n={1} icon="🌐" text='Abrí esta página en <strong>Chrome</strong>' />
                                <InstallStep n={2} icon="⋮" text='Tocá los <strong>tres puntos</strong> arriba a la derecha' />
                                <InstallStep n={3} icon="➕" text='Seleccioná <strong>"Instalar aplicación"</strong>' />
                                <InstallStep n={4} icon="✅" text='¡Ya está instalada como app!' />
                            </div>
                        )}
                    </div>
                )}

                <button
                    id="google-signin-btn"
                    className="btn btn-primary"
                    style={{ gap: 12 }}
                    onClick={signInWithGoogle}
                    disabled={loading}
                >
                    <GoogleIcon />
                    Continuar con Google
                </button>

                <p className="text-muted text-xs mt-8">
                    Al continuar aceptás los Términos de Servicio
                </p>
            </div>
        </div>
    );
}

function InstallStep({ n, icon, text }: { n: number; icon: string; text: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
                minWidth: 24, height: 24, borderRadius: '50%',
                background: 'var(--color-accent-glow)',
                border: '1px solid var(--color-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-accent)',
                flexShrink: 0, marginTop: 2,
            }}>
                {n}
            </div>
            <p
                style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5, textAlign: 'left' }}
                dangerouslySetInnerHTML={{ __html: `${icon} ${text}` }}
            />
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}
