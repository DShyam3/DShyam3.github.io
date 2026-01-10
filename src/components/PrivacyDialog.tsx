import { useState } from 'react';
import { X } from 'lucide-react';
import { DotMatrixText } from './DotMatrixText';
import './PrivacyDialog.css';

type Tab = 'privacy' | 'inspiration';

export function PrivacyDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('privacy');

    const inspirationLinks = [
        {
            name: 'Opening Page',
            url: 'https://martingauer.com',
            description: 'Martin Gauer'
        },
        {
            name: 'Inventory',
            url: 'https://goods.jackcohen.com/?category=Wishlist',
            description: 'Jack Cohen'
        },
        {
            name: 'Links',
            url: 'https://www.linklowdown.com/category/mac-app',
            description: 'Linklowdown'
        }
    ];

    const handleOpen = () => {
        setIsOpen(true);
        setActiveTab('privacy'); // Reset to privacy tab when opening
    };

    return (
        <>
            <button
                onClick={handleOpen}
                className="flex items-center hover:opacity-70 transition-opacity cursor-pointer"
            >
                <DotMatrixText text={`© ${new Date().getFullYear()}`} />
            </button>

            {isOpen && (
                <div className="privacy-overlay" onClick={() => setIsOpen(false)}>
                    <div className="privacy-card" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="privacy-close"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>

                        {/* Tab Navigation */}
                        <div className="privacy-tabs">
                            <button
                                className={`privacy-tab ${activeTab === 'privacy' ? 'active' : ''}`}
                                onClick={() => setActiveTab('privacy')}
                            >
                                <DotMatrixText text="Privacy" size="sm" />
                            </button>
                            <button
                                className={`privacy-tab ${activeTab === 'inspiration' ? 'active' : ''}`}
                                onClick={() => setActiveTab('inspiration')}
                            >
                                <DotMatrixText text="Credits" size="sm" />
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="privacy-content">
                            {activeTab === 'privacy' && (
                                <div className="tab-panel">
                                    <section className="privacy-section">
                                        <h3 className="privacy-subtitle">
                                            <DotMatrixText text="Privacy" size="sm" />
                                        </h3>
                                        <p className="privacy-text">
                                            This website is a personal portfolio and does not collect, store, or share any personal data.
                                            No cookies are used, and no analytics are tracked. Your privacy is fully respected.
                                        </p>
                                    </section>

                                    <section className="privacy-section">
                                        <h3 className="privacy-subtitle">
                                            <DotMatrixText text="Copyright" size="sm" />
                                        </h3>
                                        <p className="privacy-text">
                                            © {new Date().getFullYear()} Dhyan Shyam. All rights reserved.
                                            The content and design of this website are original works.
                                        </p>
                                    </section>
                                </div>
                            )}

                            {activeTab === 'inspiration' && (
                                <div className="tab-panel">
                                    <section className="privacy-section">
                                        <p className="privacy-text">
                                            This website was inspired by the following sources:
                                        </p>
                                        <ul className="inspiration-list">
                                            {inspirationLinks.map((link, index) => (
                                                <li key={index} className="inspiration-item">
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inspiration-link"
                                                    >
                                                        <span className="inspiration-name">{link.name}</span>
                                                        <span className="inspiration-description">— {link.description}</span>
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
