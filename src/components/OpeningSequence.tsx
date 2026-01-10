import { useState, useEffect } from 'react';
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

    const CONFIG = {
        fullText: "Hi, I'm Dhyan Shyam",
        typeSpeed: 100,
        deleteSpeed: 50,
        pauseBetweenLines: 300,
        initialDelay: 600
    };

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const typeText = async (text: string, setter: (value: string) => void) => {
        for (let i = 0; i <= text.length; i++) {
            setter(text.slice(0, i));
            await wait(CONFIG.typeSpeed);
        }
    };

    const deleteText = async (text: string, setter: (value: string) => void) => {
        for (let i = text.length; i >= 0; i--) {
            setter(text.slice(0, i));
            await wait(CONFIG.deleteSpeed);
        }
    };

    useEffect(() => {
        const runIntro = async () => {
            // Lock scroll when opening starts
            document.body.style.overflow = 'hidden';
            await wait(CONFIG.initialDelay);
            await typeText(CONFIG.fullText, setText);
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

        await deleteText(text, setText);

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

    return (
        <div id="start-screen" className="opening-screen" onClick={handleStart}>
            <StarField />
            <div className="hero-container">
                <div className="avatar-wrapper">
                    <img src="/memoji.png" alt="Pixel Avatar" className="avatar" id="hero-avatar" />
                </div>
                <div className="text-content">
                    <div className="intro-text">
                        <div className="dot-matrix-wrapper">
                            <DotMatrixText text={text} size="md" />
                            {text && <span className="typing-cursor-dot"></span>}
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
