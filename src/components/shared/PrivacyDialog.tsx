import { useState } from 'react';
import { X } from 'lucide-react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import './PrivacyDialog.css';

type Tab = 'privacy' | 'inspiration';

/**
 * Label and value on their own lines.
 *
 * These sections were paragraphs, which in a dot-matrix face at this size is
 * a wall nobody reads -- and the one thing a privacy notice has to be is
 * read. Broken into facts, the answer to "does this site track me" is two
 * words rather than a sentence buried mid-paragraph.
 *
 * A <dl> because that is what this is: terms and their definitions. Screen
 * readers announce the pairing.
 */
function FactList({ items }: { items: [string, string][] }) {
  return (
    <dl className="privacy-facts">
      {items.map(([term, value]) => (
        <div key={term} className="privacy-fact">
          <dt>
            <DotMatrixText text={term} size="xs" className="privacy-fact-term" />
          </dt>
          <dd>
            <DotMatrixText text={value} size="xs" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
                className="flex items-center hover:opacity-70 transition-opacity cursor-pointer text-muted-foreground"
            >
                <DotMatrixText text={`© ${new Date().getFullYear()}`} size="xs" />
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
                        <div className="privacy-tabs gap-4 pt-4">
                            <button
                                className={`privacy-tab flex justify-center pb-3 ${activeTab === 'privacy' ? 'active' : ''}`}
                                onClick={() => setActiveTab('privacy')}
                            >
                                <DotMatrixText text="Privacy" size="xs" className={activeTab === 'privacy' ? '' : 'opacity-60'} />
                            </button>
                            <button
                                className={`privacy-tab flex justify-center pb-3 ${activeTab === 'inspiration' ? 'active' : ''}`}
                                onClick={() => setActiveTab('inspiration')}
                            >
                                <DotMatrixText text="Credits" size="xs" className={activeTab === 'inspiration' ? '' : 'opacity-60'} />
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="privacy-content">
                            {activeTab === 'privacy' && (
                                <div className="tab-panel">
                                    <section className="privacy-section">
                                        <h3 className="privacy-subtitle mb-4">
                                            <DotMatrixText text="Privacy" size="xs" />
                                        </h3>
                                        <FactList
                                            items={[
                                                ['Cookies', 'None'],
                                                ['Personal data', 'None collected'],
                                                [
                                                    'Analytics',
                                                    'Umami, cookieless. Page, referrer, country. No profile, no tracking across sites.',
                                                ],
                                                ['Admin sign-in', 'Stores a session in your browser'],
                                            ]}
                                        />
                                    </section>

                                    <section className="privacy-section mt-8">
                                        <h3 className="privacy-subtitle mb-4">
                                            <DotMatrixText text="Copyright" size="xs" />
                                        </h3>
                                        <FactList
                                            items={[
                                                ['Owner', 'Dhyan Shyam'],
                                                ['Year', String(new Date().getFullYear())],
                                                [
                                                    'Rights',
                                                    'All reserved. Content and design are original work.',
                                                ],
                                            ]}
                                        />
                                    </section>
                                </div>
                            )}

                            {activeTab === 'inspiration' && (
                                <div className="tab-panel">
                                    <section className="privacy-section">
                                        <div className="privacy-text mb-6">
                                            <DotMatrixText
                                                text="This website was inspired by the following sources:"
                                                size="xs"
                                            />
                                        </div>
                                        <ul className="inspiration-list">
                                            {inspirationLinks.map((link, index) => (
                                                <li key={index} className="inspiration-item">
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inspiration-link flex flex-col gap-3 py-1"
                                                    >
                                                        <DotMatrixText text={link.name} size="xs" />
                                                        <DotMatrixText text={`- ${link.description}`} size="xs" className="opacity-80" />
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
