import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LinkCategoryNav } from '@/components/links/LinkCategoryNav';
import { LinkGrid } from '@/components/links/LinkGrid';
import { AddLinkDialog } from '@/components/links/AddLinkDialog';
import { useLinks } from '@/hooks/useLinks';
import { useAuth } from '@/contexts/AuthContext';

const Links = () => {
  const { isAdmin } = useAuth();
  const {
    links,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addLink,
    removeLink,
    updateLink,
    categories,
    getCategoryCount,
  } = useLinks();

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header
          title="Links"
          subtitle="Useful resources"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search links..."
        />

        <LinkCategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          getCategoryCount={getCategoryCount}
        />

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">
            {links.length} {links.length === 1 ? 'link' : 'links'}
          </p>
          {isAdmin && <AddLinkDialog onAdd={addLink} />}
        </div>

        <div className="px-4 md:px-0">
          <LinkGrid links={links} onRemove={isAdmin ? removeLink : undefined} onUpdate={isAdmin ? updateLink : undefined} />
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Links;

