import React, { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import ProductsTable from '../components/ProductsTable'
import type {
    Catalog,
    PriceField,
    Category,
    Product,
    UnifiedFilterRequest, SpecificCategoryResponse
} from '../types/types';
import { apiService } from '../services/apiService'

const Dashboard: React.FC = () => {
    const [exchangeRate, setExchangeRate] = useState<number>(80.00);
    const [selectedPriceType, setSelectedPriceType] = useState<PriceField>('priceCategoryA');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedCatalog, setSelectedCatalog] = useState<number | null>(null);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [categoriesData, setCategoriesData] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState({
        catalogs: true,
        categories: false
    });
    const [updatingProducts, setUpdatingProducts] = useState<Set<number>>(new Set());
    const [updatingCategories, setUpdatingCategories] = useState<Set<number>>(new Set());
    const [minPriceFilter, setMinPriceFilter] = useState<number | null>(null);

    const fetchCatalogs = useCallback(async (): Promise<void> => {
        try {
            setLoading(prev => ({ ...prev, catalogs: true }));
            const data = await apiService.getCatalogs();
            setCatalogs(data);

            if (data.length > 0 && selectedCatalog === null) {
                setSelectedCatalog(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching catalogs:', error);
        } finally {
            setLoading(prev => ({ ...prev, catalogs: false }));
        }
    }, [selectedCatalog]);

    const loadProducts = useCallback(async (): Promise<void> => {
        if (!selectedCatalog || selectedCategories.length === 0) {
            setCategoriesData([]);
            setProducts([]);
            return;
        }

        setLoading(p => ({ ...p, categories: true }));
        try {
            const payload: UnifiedFilterRequest = {
                catalog_id: selectedCatalog,
                category_ids: selectedCategories,
                price_type: selectedPriceType,
                exchange_rate: exchangeRate,
                return_format: 'categories',
                include_stats: true,
                page: 1,
                limit: 500,
                ...(minPriceFilter && minPriceFilter > 0 && { min_price_rub: minPriceFilter }),
            };

            const res = await apiService.unifiedFilter(payload); // объект

            const cats: Category[] = res.categories.map((c: SpecificCategoryResponse) => ({
                id: c.id,
                name: c.name,
                parent_id: c.parent_id,
                leaf: c.leaf,
                products: c.products || [],
                children: [],
            }));

            setCategoriesData(cats);
            setProducts([]);
        } catch (e) {
            console.error(e);
            setCategoriesData([]);
            setProducts([]);
        } finally {
            setLoading(p => ({ ...p, categories: false }));
        }
    }, [
        selectedCatalog,
        selectedCategories,
        minPriceFilter,
        exchangeRate,
        selectedPriceType,
    ]);

    useEffect(() => {
        void fetchCatalogs();
    }, [fetchCatalogs]);

    useEffect(() => {
        void loadProducts();
    }, [loadProducts]);

    const handleExchangeRateChange = useCallback((rate: number) => {
        setExchangeRate(rate);
    }, []);

    const handlePriceTypeChange = useCallback((priceType: PriceField) => {
        setSelectedPriceType(priceType);
    }, []);

    const handleCatalogChange = useCallback((catalogId: number) => {
        setSelectedCatalog(catalogId);
        setSelectedCategories([]);
        setMinPriceFilter(null);
        setCategoriesData([]);
        setProducts([]);
    }, []);

    const handleFilterChange = useCallback((categories: number[], minPrice: number | null) => {
        setSelectedCategories(categories);
        setMinPriceFilter(minPrice);
    }, []);

    const handleUpdateProductData = useCallback(async (productId: number): Promise<void> => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        setUpdatingProducts(prev => new Set([...prev, productId]));

        try {
            await apiService.parseYandexPartNumber(product.part_number);
            await loadProducts();
        } catch (error) {
            console.error('Error updating product data:', error);
        } finally {
            setUpdatingProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(productId);
                return newSet;
            });
        }
    }, [products, loadProducts]);

    const handleUpdateCategoryData = useCallback(async (categoryId: number): Promise<void> => {
        // При фильтре по цене categoriesData может быть пустым
        const category = categoriesData.find(c => c.id === categoryId);
        if (!category) return;

        setUpdatingCategories(prev => new Set([...prev, categoryId]));

        try {
            const categoryProducts = category.products || [];
            for (const product of categoryProducts) {
                await apiService.parseYandexPartNumber(product.part_number);
            }

            await loadProducts();
        } catch (error) {
            console.error('Error updating category data:', error);
        } finally {
            setUpdatingCategories(prev => {
                const newSet = new Set(prev);
                newSet.delete(categoryId);
                return newSet;
            });
        }
    }, [categoriesData, loadProducts]);

    const getSelectedCatalogName = useCallback((): string => {
        if (!selectedCatalog) return 'Не выбран';
        const catalog = catalogs.find(c => c.id === selectedCatalog);
        return catalog?.name || 'Не найден';
    }, [selectedCatalog, catalogs]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Header
                onExchangeRateChange={handleExchangeRateChange}
                onPriceTypeChange={handlePriceTypeChange}
                onCatalogChange={handleCatalogChange}
                onFilterChange={handleFilterChange}
                selectedCategories={selectedCategories}
                selectedCatalog={selectedCatalog}
            />

            <main className="container mx-auto px-4 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text">
                        Анализ цен товаров
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Сравнение цен
                    </p>
                </div>

                <div className="mb-6">
                    <ProductsTable
                        categories={categoriesData}
                        products={products}
                        selectedPriceType={selectedPriceType}
                        exchangeRate={exchangeRate}
                        selectedCatalog={selectedCatalog}
                        catalogName={getSelectedCatalogName()}
                        onUpdateProduct={handleUpdateProductData}
                        onUpdateCategory={handleUpdateCategoryData}
                        updatingProducts={updatingProducts}
                        updatingCategories={updatingCategories}
                        loading={loading.categories}
                        minPriceFilter={minPriceFilter}
                    />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;