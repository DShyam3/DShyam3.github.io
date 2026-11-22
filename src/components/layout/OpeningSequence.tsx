import { useState, useEffect, useRef, useCallback } from 'react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { ASSETS_URL } from '@/lib/constants';
import { SITE } from '@/config/site';

import { StarField } from '@/components/layout/StarField';
import './OpeningSequence.css';

interface OpeningSequenceProps {
    onComplete: () => void;
}

// Module scope, not component scope: none of this depends on props or state,
// so the intro effect does not need to list it as a dependency.
const CONFIG = {
    fullText: `Hi, I'm ${SITE.name}`,
    typeSpeed: 100,
    initialDelay: 600
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const typeText = async (fullText: string, setter: (value: string) => void) => {
    for (let i = 0; i <= fullText.length; i++) {
        setter(fullText.slice(0, i));
        await wait(CONFIG.typeSpeed);
    }
};

export const OpeningSequence = ({ onComplete }: OpeningSequenceProps) => {
    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [text, setText] = useState(() => (prefersReducedMotion ? CONFIG.fullText : ''));
    const [showPressStart, setShowPressStart] = useState(prefersReducedMotion);
    const [isAnimating, setIsAnimating] = useState(false);
    const [typingDone, setTypingDone] = useState(prefersReducedMotion);
    const screenRef = useRef<HTMLDivElement>(null);
    const matrixRef = useRef<HTMLDivElement>(null);

    // Delete animation via simple JS interval + direct DOM visibility toggling.
    // We avoid CSS transitions because mobile browsers (especially Safari) 
    // aggressively coalesce simultaneous transition delays, causing "blocky" deletion.
    // We avoid React state to prevent slow, full-component re-renders.
    const deleteTextDOM = useCallback((): Promise<void> => {
        return new Promise(resolve => {
            const wrapper = matrixRef.current;
            if (!wrapper) { resolve(); return; }

            const chars = Array.from(wrapper.querySelectorAll<HTMLElement>('.dot-matrix-char'));
            if (chars.length === 0) { resolve(); return; }

            // Hide cursor immediately
            const cursor = wrapper.querySelector<HTMLElement>('.typing-cursor-dot');
            if (cursor) cursor.style.visibility = 'hidden';

            let index = chars.length - 1;
            let lastTime: number | null = null;
            const msPerChar = 30; // ~2 visual frames perfectly paced

            // Use a game-style time accumulator within rAF. This prevents 
            // artificial JS timers getting throttled by mobile browsers, 
            // ensuring a perfectly paced speed (approx 600ms for full text)
            // while remaining physically synced to the screen's refresh.
            const hideNext = (timestamp: number) => {
                if (!lastTime) lastTime = timestamp;

                if (timestamp - lastTime >= msPerChar) {
                    lastTime = timestamp;
                    if (index >= 0) {
                        chars[index].style.visibility = 'hidden';
                        index--;
                    }
                }

                if (index >= 0) {
                    requestAnimationFrame(hideNext);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(hideNext);
        });
    }, []);


    useEffect(() => {
        // Lock scroll and move focus into the dialog when opening starts
        document.body.style.overflow = 'hidden';
        screenRef.current?.focus();

        if (!prefersReducedMotion) {
            const runIntro = async () => {
                await wait(CONFIG.initialDelay);
                await typeText(CONFIG.fullText, setText);
                setTypingDone(true);
                setShowPressStart(true);
            };
            runIntro();
        }

        // Cleanup: restore scroll if component unmounts unexpectedly
        return () => {
            document.body.style.overflow = '';
        };
    }, [prefersReducedMotion]);

    const handleStart = useCallback(async () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setShowPressStart(false);

        if (prefersReducedMotion) {
            document.body.style.overflow = '';
            onComplete();
            return;
        }

        // Use DOM-based deletion — zero React re-renders
        await deleteTextDOM();

        // Trigger zoom animation
        const avatar = document.getElementById('hero-avatar');
        const startScreen = document.getElementById('start-screen');

        if (avatar && startScreen) {
            avatar.classList.add('avatar-zoomed');
            startScreen.classList.add('screen-hidden');
        }

        await wait(1200);

        // Restore scroll before completing
        document.body.style.overflow = '';
        onComplete();
    }, [isAnimating, prefersReducedMotion, deleteTextDOM, onComplete]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // ⌘K / Ctrl+K opens the command palette (CommandDock listens for it
            // too). The palette sits under this screen, so get out of its way at
            // once, without the exit animation, rather than open it unseen.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                document.body.style.overflow = '';
                onComplete();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                document.body.style.overflow = '';
                onComplete();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                screenRef.current?.focus();
                return;
            }
            if ((e.key === ' ' || e.key === 'Enter') && showPressStart && !isAnimating) {
                e.preventDefault();
                handleStart();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [showPressStart, isAnimating, handleStart, onComplete]);

    // Use the final full text once typing is done to avoid re-renders
    const displayText = typingDone ? CONFIG.fullText : text;

    return (
        <div
            ref={screenRef}
            id="start-screen"
            className="opening-screen"
            role="dialog"
            aria-modal="true"
            aria-label="Welcome screen — click or press Enter to enter"
            tabIndex={-1}
            onClick={handleStart}
        >
            {!prefersReducedMotion && <StarField />}
            <div className="hero-container">
                <div className="avatar-wrapper">
                    <img src={`${ASSETS_URL}/memoji.png`} alt="Pixel Avatar" className="avatar no-outline" id="hero-avatar" />
                </div>
                <div className="text-content">
                    <div className="intro-text">
                        <div className="dot-matrix-wrapper" ref={matrixRef}>
                            <DotMatrixText text={displayText} size="md" />
                            {displayText && !prefersReducedMotion && <span className="typing-cursor-dot"></span>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="press-start-container">
                {showPressStart && (
                    <div className={prefersReducedMotion ? 'press-start' : 'press-start blinking'}>
                        <DotMatrixText text="PRESS TO ENTER" size="sm" className="text-muted-foreground" />
                    </div>
                )}
            </div>
        </div>
    );
};
