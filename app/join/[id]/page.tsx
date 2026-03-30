'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getChallenge, joinChallenge } from '@/lib/challenges';

export default function JoinPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params.id;

    const [challengeName, setChallengeName] = useState('');
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        getChallenge(id as string).then((ch) => {
            if (!ch) setError('Desafío no encontrado.');
            else setChallengeName(ch.name);
        });
    }, [id]);

    useEffect(() => {
        if (!loading && user && challengeName) {
            handleJoin();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading, challengeName]);

    const handleJoin = async () => {
        if (!user || !id) return;
        setJoining(true);
        try {
            await joinChallenge(id as string, user.uid, user.displayName ?? 'Jugador');
            router.replace(`/challenge/${id}`);
        } catch {
            setError('Error al unirte. Intenta de nuevo.');
            setJoining(false);
        }
    };

    if (error) {
        return (
            <div
                className="app-container"
                style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
            >
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>😕</div>
                <p className="font-bold">{error}</p>
            </div>
        );
    }

    if (loading || joining) {
        return (
            <div
                className="app-container"
                style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}
            >
                <span className="spinner" style={{ width: 32, height: 32 }} />
                <p className="text-muted">{joining ? 'Uniéndote...' : 'Cargando...'}</p>
            </div>
        );
    }

    // Not logged in yet — show login prompt
    return (
        <div
            className="app-container"
            style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
        >
            <div style={{ width: '100%', maxWidth: 360 }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🤝</div>
                <h1 className="page-title" style={{ marginBottom: 8, fontSize: '1.5rem' }}>
                    Te invitaron a un desafío
                </h1>
                {challengeName && (
                    <p className="font-bold text-accent" style={{ fontSize: '1.1rem', marginBottom: 24 }}>
                        "{challengeName}"
                    </p>
                )}
                <p className="text-muted text-sm" style={{ marginBottom: 32 }}>
                    Iniciá sesión para unirte automáticamente.
                </p>
                <button
                    id="join-google-btn"
                    className="btn btn-primary"
                    onClick={signInWithGoogle}
                    style={{ gap: 12 }}
                >
                    Continuar con Google →
                </button>
            </div>
        </div>
    );
}
