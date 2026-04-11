import { useState, useEffect, useRef } from 'react';
import { DotMatrixText } from './DotMatrixText';
import { StarField } from './StarField';
import './OpeningSequence.css';

interface OpeningSequenceProps {
    onComplete: () => void;
}

export const OpeningSequence = ({ onComplete }: OpeningSequenceProps) => {
    const [text, setText] = useState('');
    const [showPressStart, setShowPressStart] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [typingDone, setTypingDone] = useState(false);
    const matrixRef = useRef<HTMLDivElement>(null);

    const CONFIG = {
        fullText: "Hi, I'm Dhyan Shyam",
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

    // Delete animation via simple JS interval + direct DOM visibility toggling.
    // We avoid CSS transitions because mobile browsers (especially Safari) 
    // aggressively coalesce simultaneous transition delays, causing "blocky" deletion.
    // We avoid React state to prevent slow, full-component re-renders.
    const deleteTextDOM = (): Promise<void> => {
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
    };


    useEffect(() => {
        const runIntro = async () => {
            // Lock scroll when opening starts
            document.body.style.overflow = 'hidden';
            await wait(CONFIG.initialDelay);
            await typeText(CONFIG.fullText, setText);
            setTypingDone(true);
            setShowPressStart(true);
        };

        runIntro();

        // Cleanup: restore scroll if component unmounts unexpectedly
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleStart = async () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setShowPressStart(false);

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
    };

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.key === ' ' || e.key === 'Enter') && showPressStart && !isAnimating) {
                e.preventDefault();
                handleStart();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [showPressStart, isAnimating]);

    // Use the final full text once typing is done to avoid re-renders
    const displayText = typingDone ? CONFIG.fullText : text;

    return (
        <div id="start-screen" className="opening-screen" onClick={handleStart}>
            <StarField />
            <div className="hero-container">
                <div className="avatar-wrapper">
                    <img src="/memoji.png" alt="Pixel Avatar" className="avatar" id="hero-avatar" />
                </div>
                <div className="text-content">
                    <div className="intro-text">
                        <div className="dot-matrix-wrapper" ref={matrixRef}>
                            <DotMatrixText text={displayText} size="md" />
                            {displayText && <span className="typing-cursor-dot"></span>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="press-start-container">
                {showPressStart && (
                    <div className="press-start blinking">
                        <DotMatrixText text="PRESS TO ENTER" size="sm" className="text-muted-foreground" />
                    </div>
                )}
            </div>
        </div>
    );
};
