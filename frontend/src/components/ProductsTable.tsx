import React, { useState } from 'react'
import {
    FiRefreshCw,
    FiExternalLink,
    FiChevronDown,
    FiChevronRight,
    FiAlertCircle,
    FiBarChart2,
    FiPackage,
    FiDollarSign,
    FiActivity
} from 'react-icons/fi'
import { TbCategory } from 'react-icons/tb'
import type { Category, Product, PriceField, YandexSource } from '../types/types'

interface ProductsTableProps {
    categories: Category[];
    products: Product[];
    selectedPriceType: PriceField;
    exchangeRate: number;
    selectedCatalog: number | null;
    catalogName: string;
    onUpdateProduct: (productId: number) => Promise<void>;
    onUpdateCategory: (categoryId: number) => Promise<void>;
    updatingProducts: Set<number>;
    updatingCategories: Set<number>;
    loading: boolean;
    minPriceFilter: number | null;
}

const ProductsTable: React.FC<ProductsTableProps> = ({
                                                         categories,
                                                         products,
                                                         selectedPriceType,
                                                         exchangeRate,
                                                         selectedCatalog,
                                                         catalogName,
                                                         onUpdateProduct,
                                                         onUpdateCategory,
                                                         updatingProducts,
                                                         updatingCategories,
                                                         loading,
                                                         minPriceFilter
                                                     }) => {
    const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());

    const toggleCategory = (categoryId: number) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    const toggleSources = (productId: number) => {
        setExpandedSources(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    const getProductsInCategory = (category: Category, filterByPrice: boolean = false): Product[] => {
        let categoryProducts: Product[] = [];

        if (category.products && category.products.length > 0) {
            if (filterByPrice) {
                // Фильтруем по цене только если minPriceFilter не установлен
                // (в режиме фильтра по цене товары уже отфильтрованы на бэкенде)
                if (!minPriceFilter) {
                    categoryProducts = [...categoryProducts, ...category.products.filter(p => (p[selectedPriceType] || 0) > 0)];
                } else {
                    categoryProducts = [...categoryProducts, ...category.products];
                }
            } else {
                categoryProducts = [...categoryProducts, ...category.products];
            }
        }

        if (category.children && category.children.length > 0) {
            category.children.forEach(child => {
                categoryProducts = [...categoryProducts, ...getProductsInCategory(child, filterByPrice)];
            });
        }

        return categoryProducts;
    };

    const getCategoryStats = (category: Category) => {
        const categoryProducts = getProductsInCategory(category);
        const totalProducts = categoryProducts.length;

        const productsWithYandexData = categoryProducts.filter(p =>
            p.yandex_sources && p.yandex_sources.length > 0
        );

        const totalSources = productsWithYandexData.reduce((sum, p) =>
            sum + (p.yandex_sources?.length || 0), 0
        );

        const avgSourcesPerProduct = productsWithYandexData.length > 0
            ? totalSources / productsWithYandexData.length
            : 0;

        return {
            totalProducts,
            productsWithYandexData: productsWithYandexData.length,
            totalSources,
            avgSourcesPerProduct,
            coveragePercentage: totalProducts > 0
                ? (productsWithYandexData.length / totalProducts) * 100
                : 0
        };
    };

    const getProductAnalysis = (product: Product) => {
        const priceValueUSD = product[selectedPriceType] || 0;
        const priceValueRUB = priceValueUSD * exchangeRate;
        const yandexSources = product.yandex_sources || [];

        const sortedSources = [...yandexSources]
            .filter(source => source.retail_price && source.retail_price > 0)
            .sort((a, b) => (a.retail_price || 0) - (b.retail_price || 0));

        const topSources = sortedSources.slice(0, 5);
        const validSourcesCount = topSources.length;
        const hasSources = validSourcesCount > 0;

        let minPrice = 0;
        let avgPrice = 0;
        let bestSource: YandexSource | undefined;

        if (hasSources) {
            const prices = topSources.map(s => s.retail_price!);
            minPrice = Math.min(...prices);
            avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
            bestSource = topSources[0]; // Уже отсортированы по возрастанию
        }

        const ourPriceDifferencePercent = priceValueRUB > 0 && minPrice > 0
            ? ((minPrice - priceValueRUB) / priceValueRUB) * 100
            : 0;

        const vat = product.tax || '20%';
        const vatMultiplier = vat === '20%' ? 1.2 : vat === '10%' ? 1.1 : 1;
        const priceWithVAT = priceValueRUB * vatMultiplier;

        return {
            priceValueUSD,
            priceValueRUB,
            priceWithVAT,
            minPrice,
            avgPrice,
            bestSource,
            topSources,
            validSourcesCount,
            ourPriceDifferencePercent,
            hasSources,
            vat,
            vatMultiplier,
            productName: product.name,
            partNumber: product.part_number,
            manufacturer: product.manufacturer,
            inStock: (product.availableKurskaya + product.availableLobnenskaya) > 0
        };
    };

    const renderSourceRow = (source: YandexSource, index: number, priceValueRUB: number) => {
        const retailPrice = source.retail_price || 0;
        const vsOurPercent = priceValueRUB > 0 ? ((retailPrice - priceValueRUB) / priceValueRUB) * 100 : 0;

        return (
            <div key={source.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-100 rounded-md transition-colors duration-150">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-semibold text-gray-600 w-4">{index + 1}.</span>
                    <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 truncate font-medium"
                        title={`${source.source_name}: ${retailPrice.toLocaleString()}₽`}
                    >
                        {source.source_name}
                    </a>
                </div>
                <div className="flex items-center gap-3 ml-2">
                    <div className="text-xs font-semibold text-gray-900">
                        {retailPrice.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}₽
                    </div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getPercentColor(vsOurPercent)}`}>
                        {vsOurPercent > 0 ? '+' : ''}{vsOurPercent.toFixed(0)}%
                    </div>
                </div>
            </div>
        );
    };

    const getPercentColor = (percent: number) => {
        if (percent < 0) return 'bg-red-100 text-red-700';
        if (percent > 0) return 'bg-green-100 text-green-700';
        return 'bg-gray-100 text-gray-700';
    };

    const renderProductRow = (product: Product) => {
        const analysis = getProductAnalysis(product);
        const isUpdating = updatingProducts.has(product.id);
        const isSourcesExpanded = expandedSources.has(product.id);

        return (
            <React.Fragment key={product.id}>
                <tr className="hover:bg-blue-50 transition-colors duration-200 even:bg-gray-50">
                    <td className="py-1.5 px-2 border border-gray-200 w-[400px] min-w-[400px]">
                        <div className="text-xs font-medium text-gray-900 line-clamp-2" title={analysis.productName}>
                            {analysis.productName}
                        </div>
                        <div className="flex items-center justify-between mt-1 gap-2">
                            <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1 py-0.5 rounded-md">
                                {analysis.partNumber}
                            </span>
                            <span className="text-xs px-1 py-0.5 rounded-md font-medium bg-blue-100 text-gray-800">
                                НДС: {product.tax}
                            </span>
                        </div>
                    </td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right">
                        <div className="text-xs font-medium text-blue-600">
                            {analysis.priceValueRUB.toLocaleString('ru-RU', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })} ₽
                        </div>
                    </td>
                    <td className="py-1.5 px-2 border border-gray-200 text-right">
                        {analysis.hasSources ? (
                            <div>
                                <div className="text-xs font-bold text-blue-600">
                                    {analysis.minPrice.toLocaleString('ru-RU', {
                                        minimumFractionDigits: 0
                                    })}₽
                                </div>
                                <div className={`text-xs px-1 py-0.5 mt-0.5 inline-block rounded-full 
                                font-medium ${getPercentColor(analysis.ourPriceDifferencePercent)}`}>
                                    {analysis.ourPriceDifferencePercent > 0 ? '+' : ''}
                                    {analysis.ourPriceDifferencePercent.toFixed(0)}%
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-400 text-xs">—</div>
                        )}
                    </td>
                    <td className="py-1.5 px-2 border border-gray-200">
                        <div className="flex items-center justify-end space-x-1">
                            {analysis.bestSource?.url && (
                                <a
                                    href={analysis.bestSource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors duration-150"
                                    title={`Минимальная цена: ${analysis.minPrice.toLocaleString()}₽`}
                                >
                                    <FiExternalLink size={12} />
                                </a>
                            )}
                            {analysis.validSourcesCount > 1 && (
                                <button
                                    onClick={() => toggleSources(product.id)}
                                    className="p-0.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100
                                    rounded-full transition-colors duration-150"
                                    title={`Показать ${analysis.validSourcesCount} источников`}
                                >
                                    <FiBarChart2 size={12} />
                                </button>
                            )}
                            <button
                                onClick={() => onUpdateProduct(product.id)}
                                disabled={isUpdating}
                                className={`p-0.5 rounded-full transition-colors duration-150 
                                ${analysis.hasSources ? 'text-gray-600 hover:text-gray-800 ' +
                                    'hover:bg-gray-100' : 'text-orange-600 hover:text-orange-800 ' +
                                    'hover:bg-orange-100'} ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={analysis.hasSources ? "Обновить данные" : "Загрузить данные"}
                            >
                                {isUpdating ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                ) : (
                                    <FiRefreshCw size={12} />
                                )}
                            </button>
                        </div>
                    </td>
                </tr>

                {isSourcesExpanded && analysis.topSources.length > 0 && (
                    <tr className="bg-gray-50 even:bg-gray-100">
                        <td colSpan={4} className="py-1.5 px-2 border border-gray-200">
                            <div className="text-xs font-medium text-gray-800 mb-0.5 flex items-center gap-1">
                                <FiActivity size={12} className="text-blue-600" />
                                Цены конкурентов ({analysis.validSourcesCount}):
                            </div>
                            <div className="space-y-0.5 border-l-4 border-blue-200 pl-2">
                                {analysis.topSources.map((source, index) =>
                                    renderSourceRow(source, index, analysis.priceValueRUB)
                                )}
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    const renderCategory = (category: Category, level = 0) => {
        const stats = getCategoryStats(category);
        const isExpanded = expandedCategories.has(category.id);
        const isUpdating = updatingCategories.has(category.id);
        const categoryProducts = getProductsInCategory(category);

        return (
            <React.Fragment key={category.id}>
                <div className="mb-0.5">
                    <div
                        className={`flex items-center px-2 py-1.5 bg-white border border-gray-200 rounded-lg 
                        cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all duration-200 
                        ${level > 0 ? 'ml-4' : ''} ${isExpanded ? 'shadow-sm border-blue-200' : ''}`}
                        onClick={() => toggleCategory(category.id)}
                        style={{ marginLeft: `${level * 12}px` }}
                    >
                        <div className="flex-shrink-0 mr-0.5">
                            <button className="p-0.5 hover:bg-gray-200 rounded-full transition-colors duration-150">
                                {isExpanded ? (
                                    <FiChevronDown className="text-gray-600 w-3 h-3" />
                                ) : (
                                    <FiChevronRight className="text-gray-600 w-3 h-3" />
                                )}
                            </button>
                        </div>

                        <div className="flex-shrink-0 mr-0.5">
                            <div className={`p-0.5 rounded-full ${stats.coveragePercentage >= 80 ? 'bg-green-100 ' +
                                'text-green-600' : stats.coveragePercentage >= 50 ? 'bg-yellow-100 ' +
                                'text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                <TbCategory className="w-3 h-3" />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate" title={category.name}>
                                {category.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <div className="flex items-center text-xs text-gray-600 bg-gray-100 px-1 py-0.5
                                rounded-md font-medium">
                                    <FiPackage className="w-3 h-3 mr-0.5" />
                                    <span>{stats.totalProducts}</span>
                                </div>

                                <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-1 py-0.5
                                rounded-md font-medium">
                                    <FiBarChart2 className="w-3 h-3 mr-0.5" />
                                    <span>{stats.coveragePercentage.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-shrink-0 ml-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateCategory(category.id);
                                }}
                                disabled={isUpdating || categoryProducts.length === 0}
                                className={`px-1.5 py-0.5 text-xs font-medium rounded-xl transition-all duration-200 
                                cursor-pointer ${stats.coveragePercentage < 100 ? 'bg-orange-500 text-white ' +
                                    'hover:bg-orange-600 shadow-sm hover:shadow-md' : 'bg-gray-600 ' +
                                    'text-white hover:bg-gray-700 shadow-sm hover:shadow-md'} ${isUpdating ||
                                categoryProducts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Обновить все товары категории"
                            >
                                {isUpdating ? (
                                    <div className="flex items-center">
                                        <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2
                                        border-white mr-0.5" />
                                        Обновление...
                                    </div>
                                ) : (
                                    <div className="flex items-center">
                                        <FiRefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                        Обновить
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="mt-0.5 ml-4">
                            {categoryProducts.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                    <table className="min-w-full border-collapse table-fixed">
                                        <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-2 py-1 w-auto text-left text-xs font-bold text-gray-700
                                            uppercase tracking-wider border border-gray-200">
                                                Товар
                                            </th>
                                            <th className="px-2 py-1 w-7 text-right text-xs font-bold text-gray-700
                                            uppercase tracking-wider border border-gray-200">
                                                Цена
                                            </th>
                                            <th className="px-2 py-1 w-9 text-right text-xs font-bold text-gray-700
                                            uppercase tracking-wider border border-gray-200">
                                                Минимальная
                                            </th>
                                            <th className="px-2 py-1 w-7 text-right text-xs font-bold text-gray-700
                                            uppercase tracking-wider border border-gray-200">
                                                Действия
                                            </th>
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                        {categoryProducts.map(renderProductRow)}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-2 text-xs text-gray-500 bg-gray-50 rounded-lg
                                border border-dashed border-gray-300 shadow-sm">
                                    Нет товаров в категории
                                </div>
                            )}
                        </div>
                    )}

                    {category.children && category.children.length > 0 && (
                        <div className="mt-0.5">
                            {category.children.map(child => renderCategory(child, level + 1))}
                        </div>
                    )}
                </div>
            </React.Fragment>
        );
    };

    const getOverallStats = () => {
        let totalProducts = 0;
        let productsWithYandexData = 0;
        let totalSources = 0;

        categories.forEach(category => {
            const categoryProducts = getProductsInCategory(category);
            totalProducts += categoryProducts.length;

            categoryProducts.forEach(product => {
                if (product.yandex_sources && product.yandex_sources.length > 0) {
                    productsWithYandexData++;
                    totalSources += product.yandex_sources.length;
                }
            });
        });

        const coveragePercentage = totalProducts > 0 ? (productsWithYandexData / totalProducts) * 100 : 0;
        const avgSourcesPerProduct = productsWithYandexData > 0 ? totalSources / productsWithYandexData : 0;

        return {
            totalProducts,
            productsWithYandexData,
            coveragePercentage,
            avgSourcesPerProduct,
            totalCategories: categories.length
        };
    };

    const overallStats = getOverallStats();

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Загрузка данных...</p>
                </div>
            </div>
        );
    }

    if (!selectedCatalog) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full
                    mb-4 shadow-inner">
                        <TbCategory className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Каталог не выбран</h3>
                    <p className="text-sm text-gray-600">Пожалуйста, выберите каталог в заголовке для анализа</p>
                </div>
            </div>
        );
    }

    // ОСНОВНОЕ ИЗМЕНЕНИЕ: Обработка режима фильтра по цене
    if (minPriceFilter && products.length > 0) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-900 flex items-center gap-1">
                                <FiActivity className="w-4 h-4 text-gray-800" />
                                Товары дороже {minPriceFilter.toLocaleString()}₽
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-medium text-gray-700 select-none">
                                    {catalogName}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="text-sm font-medium text-gray-700">
                                    {products.length} товаров
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 bg-gray-100
                        px-2 py-1 rounded-full">
                                <FiDollarSign className="w-3 h-3 text-green-600" />
                                <span>1$ = {exchangeRate.toFixed(1)}₽</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-2">
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full border-collapse table-fixed">
                            <thead className="bg-gray-100">
                            <tr>
                                <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Товар
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Наша цена
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Минимальная
                                </th>
                                <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Действия
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white">
                            {/* В режиме фильтра по цене ВСЕ товары уже отфильтрованы на бэкенде */}
                            {products.map(renderProductRow)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Обычный режим (без фильтра по цене)
    if (categories.length === 0 && products.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full
                    mb-4 shadow-inner">
                        <FiAlertCircle className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Нет категорий</h3>
                    <p className="text-sm text-gray-600">Используйте фильтры для выбора категорий или товаров</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-1">
                            <FiActivity className="w-4 h-4 text-gray-800" />
                            Анализ цен
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-medium text-gray-700 select-none">
                                {catalogName}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm font-medium text-gray-700">
                                {overallStats.totalCategories} категорий
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-sm font-medium text-gray-700">
                                {overallStats.totalProducts} товаров
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm font-medium text-gray-700 bg-gray-100
                        px-2 py-1 rounded-full">
                            <FiDollarSign className="w-3 h-3 text-green-600" />
                            <span>1$ = {exchangeRate.toFixed(1)}₽</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-2">
                {categories.length > 0 ? (
                    <div className="space-y-0.5">
                        {categories.map(category => renderCategory(category))}
                    </div>
                ) : products.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                        <table className="min-w-full border-collapse table-fixed">
                            <thead className="bg-gray-100">
                            <tr>
                                <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Товар
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Наша цена
                                </th>
                                <th className="px-2 py-1 text-right text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Минимальная
                                </th>
                                <th className="px-2 py-1 text-left text-xs font-bold text-gray-700 uppercase
                                tracking-wider border border-gray-200">
                                    Действия
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white">
                            {/* В обычном режиме фильтруем только по цене > 0 */}
                            {products.filter(p => (p[selectedPriceType] || 0) > 0).map(renderProductRow)}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-4 text-sm text-gray-500">
                        Нет данных для отображения
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductsTable;