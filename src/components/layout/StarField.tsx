import { useEffect, useState, useRef } from 'react';
import './StarField.css';

interface Star {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    twinkleDelay: number;
    twinkleDuration: number;
}

interface ShootingStar {
    id: number;
    startX: number;
    startY: number;
    angle: number;
    length: number;
    duration: number;
    delay: number;
}

export const StarField = () => {
    const [stars, setStars] = useState<Star[]>([]);
    const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
    const shootingStarId = useRef(0);

    // Generate static stars on mount with more variation
    useEffect(() => {
        const generateStars = () => {
            // Increased star density (was 6000, now 3000 for more stars)
            const starCount = Math.floor(window.innerWidth * window.innerHeight / 3000);
            const newStars: Star[] = [];

            for (let i = 0; i < starCount; i++) {
                // Create variety in star sizes - most small, few larger
                const sizeRandom = Math.random();
                let size: number;
                if (sizeRandom < 0.7) {
                    size = Math.random() * 1 + 0.5; // 0.5-1.5px (small, most common)
                } else if (sizeRandom < 0.9) {
                    size = Math.random() * 1 + 1.5; // 1.5-2.5px (medium)
                } else {
                    size = Math.random() * 1.5 + 2.5; // 2.5-4px (large, rare)
                }

                newStars.push({
                    id: i,
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    size,
                    opacity: Math.random() * 0.4 + 0.3, // 0.3-0.7
                    twinkleDelay: Math.random() * 5, // 0-5s delay
                    twinkleDuration: Math.random() * 3 + 2, // 2-5s duration
                });
            }

            setStars(newStars);
        };

        generateStars();
        window.addEventListener('resize', generateStars);
        return () => window.removeEventListener('resize', generateStars);
    }, []);

    // Create multiple shooting stars periodically with natural variation
    useEffect(() => {
        const createShootingStars = () => {
            // Create 1-3 shooting stars at once
            const count = Math.floor(Math.random() * 3) + 1;
            const newStars: ShootingStar[] = [];

            for (let i = 0; i < count; i++) {
                shootingStarId.current += 1;

                // Randomize direction - can come from different sides
                const directionRandom = Math.random();
                let startX: number, startY: number, angle: number;

                if (directionRandom < 0.5) {
                    // Top-left to bottom-right (most common)
                    startX = Math.random() * 50 + 5; // 5-55% from left
                    startY = Math.random() * 30 + 5; // 5-35% from top
                    angle = Math.random() * 25 + 30; // 30-55 degrees
                } else if (directionRandom < 0.75) {
                    // Top-right to bottom-left
                    startX = Math.random() * 40 + 50; // 50-90% from left
                    startY = Math.random() * 30 + 5; // 5-35% from top
                    angle = Math.random() * 25 + 120; // 120-145 degrees
                } else {
                    // Top-center going down at various angles
                    startX = Math.random() * 60 + 20; // 20-80% from left
                    startY = Math.random() * 20 + 5; // 5-25% from top
                    angle = Math.random() * 40 + 60; // 60-100 degrees
                }

                // Varying lengths and speeds
                const length = Math.random() * 60 + 80; // 80-140px trail
                const duration = Math.random() * 0.6 + 0.5; // 0.5-1.1s
                const delay = Math.random() * 0.3 * i; // Stagger multiple stars slightly

                newStars.push({
                    id: shootingStarId.current,
                    startX,
                    startY,
                    angle,
                    length,
                    duration,
                    delay,
                });
            }

            setShootingStars(prev => [...prev, ...newStars]);

            // Remove after longest animation completes
            const maxDuration = Math.max(...newStars.map(s => s.duration + s.delay));
            setTimeout(() => {
                const idsToRemove = new Set(newStars.map(s => s.id));
                setShootingStars(prev => prev.filter(s => !idsToRemove.has(s.id)));
            }, maxDuration * 1000 + 200);
        };

        // Schedule shooting stars at random intervals (2-5 seconds apart)
        const scheduleNext = (): ReturnType<typeof setTimeout> => {
            const delay = Math.random() * 3000 + 2000;
            return setTimeout(() => {
                createShootingStars();
                scheduleNext();
            }, delay);
        };

        // Start first batch after initial delay
        const initialTimeout = setTimeout(() => {
            createShootingStars();
            scheduleNext();
        }, 1500);

        return () => clearTimeout(initialTimeout);
    }, []);

    return (
        <div className="star-field">
            {/* Static stars with varying properties */}
            {stars.map(star => (
                <div
                    key={star.id}
                    className="star"
                    style={{
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        opacity: star.opacity,
                        '--twinkle-delay': `${star.twinkleDelay}s`,
                        '--twinkle-duration': `${star.twinkleDuration}s`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Shooting stars with natural trail effect */}
            {shootingStars.map(star => (
                <div
                    key={star.id}
                    className="shooting-star-wrapper"
                    style={{
                        left: `${star.startX}%`,
                        top: `${star.startY}%`,
                        transform: `rotate(${star.angle}deg)`,
                        '--shoot-duration': `${star.duration}s`,
                        '--trail-length': `${star.length}px`,
                    } as React.CSSProperties}
                >
                    <div className="shooting-star-head" />
                    <div className="shooting-star-trail" />
                </div>
            ))}
        </div>
    );
};
