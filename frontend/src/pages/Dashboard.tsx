import React, { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import ProductsTable from '../components/ProductsTable'
// import StatsPanel from '../components/StatsPanel'
import type {
    Catalog,
    PriceField,
    Category,
    Product,
    SpecificCategoryResponse,
    SpecificCategoriesResponse
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

    const convertToCategories = useCallback((specificCategories: SpecificCategoriesResponse): Category[] => {
        return specificCategories.map((cat: SpecificCategoryResponse) => ({
            id: cat.id,
            name: cat.name,
            parent_id: cat.parent_id,
            leaf: cat.leaf,
            products: cat.products || [],
            children: []
        }));
    }, []);

    const fetchCatalogs = useCallback(async (): Promise<void> => {
        try {
            setLoading(prev => ({ ...prev, catalogs: true }));
            const data = await apiService.getCatalogs();
            setCatalogs(data);

            if (data.length > 0) {
                setSelectedCatalog(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching catalogs:', error);
        } finally {
            setLoading(prev => ({ ...prev, catalogs: false }));
        }
    }, []);

    const reloadSelectedCategories = useCallback(async (): Promise<void> => {
        if (!selectedCatalog || selectedCategories.length === 0) {
            setCategoriesData([]);
            setProducts([]);
            return;
        }

        const selectedCatalogObj = catalogs.find(c => c.id === selectedCatalog);
        if (!selectedCatalogObj) return;

        try {
            setLoading(prev => ({ ...prev, categories: true }));

            const specificCategories: SpecificCategoriesResponse = await apiService.getSpecificCategoriesWithProducts(
                selectedCatalogObj.name,
                selectedCategories
            );

            const convertedCategories = convertToCategories(specificCategories);
            setCategoriesData(convertedCategories);

            const allProducts = convertedCategories.flatMap(cat => cat.products || []);
            setProducts(allProducts);
        } catch (error) {
            console.error('Error reloading categories:', error);
            setCategoriesData([]);
            setProducts([]);
        } finally {
            setLoading(prev => ({ ...prev, categories: false }));
        }
    }, [selectedCatalog, selectedCategories, catalogs, convertToCategories]);

    useEffect(() => {
        void fetchCatalogs();
    }, [fetchCatalogs]);

    useEffect(() => {
        const fetchProductsByCategories = async (): Promise<void> => {
            if (!selectedCatalog || selectedCategories.length === 0) {
                setCategoriesData([]);
                setProducts([]);
                return;
            }

            try {
                setLoading(prev => ({ ...prev, categories: true }));

                const selectedCatalogObj = catalogs.find(c => c.id === selectedCatalog);
                if (!selectedCatalogObj) return;

                const specificCategories: SpecificCategoriesResponse = await apiService.getSpecificCategoriesWithProducts(
                    selectedCatalogObj.name,
                    selectedCategories
                );

                const convertedCategories = convertToCategories(specificCategories);
                setCategoriesData(convertedCategories);

                const allProducts = convertedCategories.flatMap(cat => cat.products || []);
                setProducts(allProducts);

            } catch (error) {
                console.error('Error fetching specific categories:', error);
                setCategoriesData([]);
                setProducts([]);
            } finally {
                setLoading(prev => ({ ...prev, categories: false }));
            }
        };

        void fetchProductsByCategories();
    }, [selectedCatalog, selectedCategories, catalogs, convertToCategories, selectedPriceType]);

    const handleExchangeRateChange = useCallback((rate: number) => {
        setExchangeRate(rate);
    }, []);

    const handlePriceTypeChange = useCallback((priceType: PriceField) => {
        setSelectedPriceType(priceType);
    }, []);

    const handleCatalogChange = useCallback((catalogId: number) => {
        setSelectedCatalog(catalogId);
        setSelectedCategories([]); // Сбрасываем выбранные категории
        setCategoriesData([]);
        setProducts([]);
    }, []);

    const handleFilterChange = useCallback((categories: number[]) => {
        setSelectedCategories(categories);
    }, []);

    const handleUpdateProductData = useCallback(async (productId: number): Promise<void> => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        setUpdatingProducts(prev => new Set([...prev, productId]));

        try {
            await apiService.parseYandexPartNumber(product.part_number);
            await reloadSelectedCategories();
        } catch (error) {
            console.error('Error updating product data:', error);
        } finally {
            setUpdatingProducts(prev => {
                const newSet = new Set(prev);
                newSet.delete(productId);
                return newSet;
            });
        }
    }, [products, reloadSelectedCategories]);

    const handleUpdateCategoryData = useCallback(async (categoryId: number): Promise<void> => {
        const category = categoriesData.find(c => c.id === categoryId);
        if (!category) return;

        setUpdatingCategories(prev => new Set([...prev, categoryId]));

        try {
            const categoryProducts = category.products || [];
            for (const product of categoryProducts) {
                await apiService.parseYandexPartNumber(product.part_number);
            }

            await reloadSelectedCategories();
        } catch (error) {
            console.error('Error updating category data:', error);
        } finally {
            setUpdatingCategories(prev => {
                const newSet = new Set(prev);
                newSet.delete(categoryId);
                return newSet;
            });
        }
    }, [categoriesData, reloadSelectedCategories]);

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

                {/* Основная таблица */}
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
                    />
                </div>
                {/*
                <StatsPanel
                    products={products}
                    categories={categoriesData}
                    selectedCategories={selectedCategories}
                    exchangeRate={exchangeRate}
                    selectedPriceType={selectedPriceType}
                    catalogName={getSelectedCatalogName()}
                    updatingProducts={updatingProducts}
                    updatingCategories={updatingCategories}
                    loading={loading.categories}
                />
                */}
            </main>
        </div>
    );
};

export default Dashboard;