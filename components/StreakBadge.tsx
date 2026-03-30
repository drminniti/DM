'use client';

interface StreakBadgeProps {
    streak: number;
    size?: 'sm' | 'md' | 'lg';
}

export default function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
    const cls =
        streak >= 7
            ? 'streak-badge perfect'
            : streak >= 3
                ? 'streak-badge hot'
                : 'streak-badge';

    const fontSize =
        size === 'lg' ? '1.1rem' : size === 'sm' ? '0.75rem' : '0.875rem';

    return (
        <span className={cls} style={{ fontSize }}>
            🔥 {streak} {streak === 1 ? 'día' : 'días'}
        </span>
    );
}
