import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { DotMatrixText } from "@/components/dot-matrix/DotMatrixText";
import { CategoryNav } from "@/components/layout/CategoryNav";
import { ItemGrid } from "@/components/shared/ItemGrid";
import { AddItemDialog } from "@/components/shared/AddItemDialog";
import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowDownAZ, Clock } from "lucide-react";
import { useMemo } from "react";
import { WARDROBE_SUBCATEGORIES, HOMELAB_SUBCATEGORIES } from "@/types/inventory";

const Inventory = () => {
  const { isAdmin } = useAuth();
  const {
    items,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addItem,
    removeItem,
    updateItem,
    categories,
    getCategoryCount,
    sortOrder,
    setSortOrder,
  } = useInventory();

  // Calculate total valuation of current items
  const totalValuation = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.isWishlist) return sum;
      return sum + (item.price || 0);
    }, 0);
  }, [items]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title="Inventory" subtitle="Things I own" />

        <CategoryNav
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          getCategoryCount={getCategoryCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
            {activeCategory !== "wardrobe" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder(
                    sortOrder === "alphabetical" ? "recent" : "alphabetical",
                  )
                }
                className="h-8 px-2.5 text-xs whitespace-nowrap gap-1.5"
              >
                {sortOrder === "alphabetical" ? (
                  <>
                    <ArrowDownAZ className="h-3.5 w-3.5" />
                    <DotMatrixText text="A-Z" size="xs" />
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <DotMatrixText text="RECENT" size="xs" />
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-sm font-semibold">
                  {formatPrice(totalValuation)}
                </p>
              </div>
            )}
            {isAdmin && <AddItemDialog onAdd={addItem} />}
          </div>
        </div>

        <div className="px-4 md:px-0">
          <ItemGrid
            items={items}
            onRemove={isAdmin ? removeItem : undefined}
            onUpdate={isAdmin ? updateItem : undefined}
            groupBySubcategory={activeCategory === "wardrobe" || activeCategory === "homelab"}
            subcategoriesList={
              activeCategory === "wardrobe"
                ? WARDROBE_SUBCATEGORIES
                : activeCategory === "homelab"
                ? HOMELAB_SUBCATEGORIES
                : undefined
            }
          />
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Inventory;
