import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { FiX, FiCheck, FiLoader, FiSearch, FiFilter } from 'react-icons/fi'
import { TbCategory, TbCategory2 } from 'react-icons/tb'
import { MdCategory, MdViewTimeline } from 'react-icons/md'
import type {Catalog, CategoryOnly, CategoryStats, PriceField} from '../types/types'
import { apiService } from '../services/apiService'

interface FiltersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (selectedCategories: number[], minPrice: number | null) => void;
    initialSelectedCategories: number[];
    catalogId: number | null;
    exchangeRate: number;
    priceType: PriceField;
}

const FiltersModal: React.FC<FiltersModalProps> = ({
                                                       isOpen,
                                                       onClose,
                                                       onSubmit,
                                                       initialSelectedCategories,
                                                       catalogId,
                                                       exchangeRate,
                                                       priceType
                                                   }) => {
    const [categories, setCategories] = useState<CategoryOnly[]>([]);
    const [displayCategories, setDisplayCategories] = useState<CategoryOnly[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<number[]>(initialSelectedCategories);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [catalogName, setCatalogName] = useState<string>('');
    const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
    const [fullCatsStats, setFullCatsStats] = useState<Map<number, CategoryStats>>(new Map());
    const [effectiveStats, setEffectiveStats] = useState<Map<number, CategoryStats>>(new Map());
    const [statsLoaded, setStatsLoaded] = useState(false);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [priceInput, setPriceInput] = useState('');
    const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(null);

    const collectAllIds = (cats: CategoryOnly[]): number[] => {
        const ids: number[] = [];
        const walk = (list: CategoryOnly[]) => {
            list.forEach(c => {
                if (!c) return;
                ids.push(c.id);
                if (c.children?.length) walk(c.children);
            });
        };
        walk(cats);
        return ids;
    };

    const filterEmptyCategories = useCallback((cats: CategoryOnly[], withProductsSet: Set<number>): CategoryOnly[] => {
        return cats
            .filter(cat => {
                if (!cat) return false;

                if (withProductsSet.has(cat.id)) {
                    return true;
                }

                if (cat.children?.length) {
                    const filteredChildren = filterEmptyCategories(cat.children, withProductsSet);
                    if (filteredChildren.length > 0) {
                        cat.children = filteredChildren;
                        return true;
                    }
                }

                return false;
            })
            .map(cat => ({
                ...cat,
                children: cat.children || []
            }));
    }, []);

    useEffect(() => {
        setSelectedCategories(initialSelectedCategories);
    }, [initialSelectedCategories]);

    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const loadedCatalogs = await apiService.getCatalogs();
                setCatalogs(loadedCatalogs);
            } catch (err) {
                console.error('Error loading catalogs:', err);
            }
        };

        if (isOpen) {
            void loadCatalogs();
        }
    }, [isOpen]);

    useEffect(() => {
        if (catalogId && catalogs.length > 0) {
            const selectedCatalog = catalogs.find((c: Catalog) => c.id === catalogId);
            setCatalogName(selectedCatalog?.name || '');
        } else {
            setCatalogName('');
        }
    }, [catalogId, catalogs]);

    useEffect(() => {
        if (catalogId) {
            setCategories([]);
            setDisplayCategories([]);
            setSelectedCategories([]);
            setExpandedCategories([]);
            setFullCatsStats(new Map());
            setEffectiveStats(new Map());
            setStatsLoaded(false);
            setError(null);
            setSearchTerm('');
            setAppliedMinPrice(null);
            setPriceInput('');
        }
    }, [catalogId]);

    const fetchCategories = useCallback(async () => {
        if (!catalogId || !catalogName) {
            setCategories([]);
            setDisplayCategories([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        setExpandedCategories([]);
        setFullCatsStats(new Map());
        setEffectiveStats(new Map());
        setStatsLoaded(false);

        try {
            const response = await apiService.getCategoriesByCatalog(catalogName);

            if (response && response.length > 0) {
                setCategories(response);
                setDisplayCategories(response);
                const rootIds = response
                    .filter(cat => cat?.parent_id === null)
                    .map(cat => cat.id);
                setExpandedCategories(rootIds);
            } else {
                setCategories([]);
                setDisplayCategories([]);
                setError('Категории не найдены');
            }

        } catch (err) {
            setError('Ошибка загрузки категорий');
            console.error('Error fetching categories:', err);
        } finally {
            setIsLoading(false);
        }
    }, [catalogId, catalogName]);

    useEffect(() => {
        if (isOpen && catalogId && catalogName) {
            void fetchCategories();
        } else if (isOpen && !catalogId) {
            setError('Сначала выберите каталог');
            setCategories([]);
            setDisplayCategories([]);
        }
    }, [isOpen, catalogId, catalogName, fetchCategories]);

    useEffect(() => {
        if (!isOpen || !catalogName || !categories.length) return;

        const loadStats = async () => {
            setStatsLoaded(false);
            try {
                const allIds = collectAllIds(categories);
                const statsArr = await apiService.getCategoriesStats(catalogName, allIds);

                const withProductsSet = new Set(
                    statsArr
                        .filter(stat => stat.total_products > 0)
                        .map(stat => stat.category_id)
                );

                const filteredCategories = filterEmptyCategories([...categories], withProductsSet);
                setDisplayCategories(filteredCategories);

                const map = new Map(statsArr.map(s => [s.category_id, s]));
                setFullCatsStats(map);
                setEffectiveStats(map);
            } catch (e) {
                console.error('stats error', e);
            } finally {
                setStatsLoaded(true);
            }
        };

        void loadStats();
    }, [isOpen, catalogName, categories, filterEmptyCategories]);

    useEffect(() => {
        if (!statsLoaded || !catalogId) return;

        const applyPriceFilter = async () => {
            if (appliedMinPrice === null) {
                setEffectiveStats(new Map(fullCatsStats));
                const withProductsSet = new Set(
                    Array.from(fullCatsStats.values())
                        .filter(stat => stat.total_products > 0)
                        .map(stat => stat.category_id)
                );
                const filteredCategories = filterEmptyCategories([...categories], withProductsSet);
                setDisplayCategories(filteredCategories);
                return;
            }

            setIsLoading(true);
            try {
                const allIds = collectAllIds(categories);
                const payload = {
                    catalog_id: catalogId,
                    rub_cost: appliedMinPrice,
                    exchange_rate: exchangeRate,
                    price_type: priceType,
                    category_ids: allIds
                };
                console.log(payload);
                const response = await apiService.filterCategoriesByPrice(payload);

                console.log(response);

                const newMap = new Map(
                    Array.from(fullCatsStats).map(([id, stat]) => [id, { ...stat, total_products: 0 }])
                );

                response.forEach(r => {
                    const stat = newMap.get(r.category_id);
                    if (stat) {
                        newMap.set(r.category_id, {
                            ...stat,
                            total_products: r.products_count,
                            has_yandex_sources: r.products_with_yandex,
                        });
                    }
                });

                setEffectiveStats(newMap);

                const withProductsSet = new Set(response.map(r => r.category_id));
                const filteredCategories = filterEmptyCategories([...categories], withProductsSet);
                setDisplayCategories(filteredCategories);
            } catch (e) {
                console.error('Error applying price filter:', e);
                setError('Ошибка применения фильтра по цене');
            } finally {
                setIsLoading(false);
            }
        };

        void applyPriceFilter();
    }, [appliedMinPrice, statsLoaded, catalogId, exchangeRate, priceType, categories, fullCatsStats, filterEmptyCategories]);

    const toggleCategory = (categoryId: number) => {
        setSelectedCategories(prev => {
            if (prev.includes(categoryId)) {
                return prev.filter(id => id !== categoryId);
            } else {
                if (prev.length >= 10) {
                    alert('Можно выбрать не более 10 категорий');
                    return prev;
                }
                return [...prev, categoryId];
            }
        });
    };

    const toggleExpand = (categoryId: number) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleSubmit = () => {
        onSubmit(selectedCategories, appliedMinPrice);
        onClose();
    };

    const handleClearAll = () => {
        setSelectedCategories([]);
        setAppliedMinPrice(null);
        setPriceInput('');
    };

    const handleRetry = () => {
        setError(null);
        void fetchCategories();
    };

    const handleSelectAll = () => {
        const allLeafIds = getAllLeafCategoryIds(displayCategories);
        const limitedIds = allLeafIds.slice(0, 10);
        setSelectedCategories(limitedIds);

        if (allLeafIds.length > 10) {
            alert(`Выбрано максимальное количество категорий (10)`);
        }
    };

    const getAllLeafCategoryIds = (cats: CategoryOnly[]): number[] => {
        let ids: number[] = [];
        cats.forEach(cat => {
            if (!cat) return;

            if (cat.leaf || !cat.children || cat.children.length === 0) {
                ids.push(cat.id);
            }
            if (cat.children && cat.children.length > 0) {
                ids = [...ids, ...getAllLeafCategoryIds(cat.children)];
            }
        });
        return ids;
    };

    const { filteredCategories, hasResults } = useMemo(() => {
        if (!searchTerm.trim()) {
            return { filteredCategories: displayCategories, hasResults: true };
        }

        const searchLower = searchTerm.toLowerCase();
        const results: CategoryOnly[] = [];
        const parentsToExpand = new Set<number>();

        const searchInTree = (
            cats: CategoryOnly[],
            parentPath: CategoryOnly[] = []): void => {

            for (const cat of cats) {
                if (!cat) continue;

                const currentPath = [...parentPath, cat];
                const nameMatches = cat.name?.toLowerCase().includes(searchLower) ?? false;

                if (nameMatches) {
                    currentPath.slice(0, -1).forEach(p => {
                        if (p.id !== undefined) parentsToExpand.add(p.id);
                    });

                    let currentLevel: CategoryOnly[] = results;

                    for (const node of currentPath) {
                        let existing = currentLevel.find(c => c.id === node.id);

                        if (!existing) {
                            existing = {
                                ...node,
                                children: []
                            };
                            currentLevel.push(existing);
                        }

                        currentLevel = existing.children!;
                    }
                }

                if (cat.children && cat.children.length > 0) {
                    searchInTree(cat.children, currentPath);
                }
            }
        };

        searchInTree(displayCategories);

        if (parentsToExpand.size > 0) {
            setExpandedCategories(prev => [
                ...new Set([...prev, ...Array.from(parentsToExpand)])
            ]);
        }

        const hasResults = results.length > 0;

        return {
            filteredCategories: results,
            hasResults
        };
    }, [displayCategories, searchTerm]);

    const renderCategoryItem = (c: CategoryOnly, level = 0) => {
        if (!c) return null;

        const stat = effectiveStats.get(c.id);
        const isExpanded = expandedCategories.includes(c.id);
        const isSelected = selectedCategories.includes(c.id);
        const hasChildren = c.children?.length > 0;
        const isLeaf = c.leaf || !hasChildren;

        const percent = (stat?.total_products && isLeaf)
            ? Math.round((stat.has_yandex_sources / stat.total_products) * 100)
            : 0;

        const countProductsInTree = (category: CategoryOnly): number => {
            const catStat = effectiveStats.get(category.id);
            let total = catStat?.total_products || 0;

            if (category.children?.length) {
                category.children.forEach(child => {
                    total += countProductsInTree(child);
                });
            }
            return total;
        };

        const hasProductsInTree = hasChildren ? countProductsInTree(c) > 0 : (stat?.total_products || 0) > 0;

        return (
            <div key={c.id} className="mb-1 transition-all duration-200">
                <div className="flex items-center group">
                    <div style={{ width: `${level * 20}px` }} />

                    {hasChildren ? (
                        <button
                            onClick={() => toggleExpand(c.id)}
                            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-800
                            hover:bg-gray-100 rounded-full transition"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-7" />
                    )}

                    <button
                        onClick={() => toggleCategory(c.id)}
                        disabled={!isLeaf}
                        className={`flex-1 flex items-center min-w-0 px-3 py-2.5 rounded-lg shadow-sm transition-all ${
                            isSelected
                                ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                                : 'bg-white border border-gray-100 hover:bg-gray-50'
                        } ${!isLeaf ? 'cursor-default opacity-80' : ''}`}
                        title={isLeaf ? c.name : `${c.name} (имеет подкатегории)`}
                    >
                        <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                                isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 ' +
                                    'group-hover:bg-gray-200'
                            }`}
                        >
                            {isLeaf ? <MdCategory className="w-4 h-4" /> : <TbCategory2 className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between">
                            <span className={`truncate text-sm font-medium 
                            ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                                {c.name}
                            </span>
                                {isSelected && <FiCheck className="ml-2 text-blue-600" size={16} />}
                            </div>

                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                                {hasChildren && (
                                    <span>{c.children!.length} подкат.</span>
                                )}

                                {hasChildren ? (
                                    hasProductsInTree ? (
                                        <span className="text-blue-500"></span>
                                    ) : (
                                        <span className="text-gray-400">Загрузка...</span>
                                    )
                                ) : (
                                    <>
                                        {stat && stat.total_products > 0 ? (
                                            <>
                                                <span>{stat.total_products} товаров</span>
                                                <span className="text-blue-600">{percent}% обработано</span>
                                            </>
                                        ) : statsLoaded ? (
                                            <span className="text-gray-400">0 товаров</span>
                                        ) : (
                                            <span className="text-gray-400">Загрузка...</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </button>
                </div>

                {hasChildren && isExpanded && c.children && (
                    <div className="mt-1 overflow-hidden transition-all duration-200">
                        {renderCategoryTree(c.children, level + 1)}
                    </div>
                )}
            </div>
        );
    };

    const renderCategoryTree = (categories: CategoryOnly[] = [], level = 0) => {
        if (!categories || categories.length === 0) return null;

        return categories.map(category => renderCategoryItem(category, level));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity
            duration-300" onClick={onClose} />

            <div className="relative min-h-screen flex items-start justify-center p-4 pt-16">
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh]
                overflow-hidden border border-gray-100/50 transform transition-all duration-300 scale-95
                opacity-0 animate-modal-open">
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-50 to-white border-b
                    border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-500 rounded-lg
                                shadow-md">
                                    <FiFilter className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Фильтр категорий
                                    </h2>
                                    <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1.5">
                                        {catalogName ? (
                                            <>
                                                <TbCategory className="w-4 h-4 text-black-600" />
                                                Каталог: {catalogName}
                                            </>
                                        ) : 'Выберите категории для фильтрации'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-200 rounded-xl transition-all
                                duration-200 cursor-pointer"
                            >
                                <FiX className="w-5 h-5 text-red-500" />
                            </button>
                        </div>
                    </div>

                    <div className="p-4">
                        {!catalogId ? (
                            <div className="text-center py-10">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100
                                rounded-full mb-4 shadow-inner">
                                    <MdViewTimeline className="w-8 h-8 text-gray-500" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Каталог не выбран</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    Выберите каталог в хедере для фильтрации категорий
                                </p>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white
                                    rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300
                                    font-semibold shadow-md hover:shadow-lg"
                                >
                                    Закрыть
                                </button>
                            </div>
                        ) : error ? (
                            <div className="text-center py-10">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100
                                rounded-full mb-4 shadow-inner">
                                    <FiX className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Ошибка загрузки</h3>
                                <p className="text-sm text-red-600 mb-6">{error}</p>
                                <button
                                    onClick={handleRetry}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white
                                    rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300
                                    font-semibold shadow-md hover:shadow-lg"
                                >
                                    Попробовать снова
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4 mb-6">
                                    <div className="relative">
                                        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2
                                        text-gray-500 w-4 h-4" />
                                        <input
                                            type="text"
                                            placeholder="Поиск категорий..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl
                                            focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                                            duration-300 shadow-sm hover:shadow-md bg-white"
                                            disabled={isLoading}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2
                                                text-gray-500"
                                            >
                                                <FiX className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="px-3 py-1.5 bg-blue-50 text-gray-700 rounded-lg text-sm
                                            font-semibold shadow-sm">
                                                Выбрано: {selectedCategories.length}/10
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    placeholder="Дороже (руб)"
                                                    value={priceInput}
                                                    onChange={(e) => setPriceInput(e.target.value)}
                                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border border-gray-200 text-gray-700 hover:bg-gray-100 bg-gray-50"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const price = Number(priceInput);
                                                        if (!isNaN(price) && price > 0) {
                                                            setAppliedMinPrice(price);
                                                            setPriceInput('');
                                                        }
                                                    }}
                                                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 border cursor-pointer bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                                >
                                                    Применить
                                                </button>
                                            </div>

                                            {isLoading && (
                                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                    <FiLoader className="animate-spin w-4 h-4" />
                                                    <span>Загрузка...</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={handleSelectAll}
                                                disabled={isLoading || displayCategories.length === 0}
                                                className="px-4 py-2 text-sm font-semibold text-blue-600
                                                hover:text-blue-800 disabled:text-gray-400
                                                transition-colors duration-200 cursor-pointer"
                                            >
                                                Выбрать все
                                            </button>
                                            <button
                                                onClick={handleClearAll}
                                                disabled={selectedCategories.length === 0 && appliedMinPrice === null}
                                                className="px-4 py-2 text-sm font-semibold text-gray-600
                                                hover:text-gray-800 disabled:text-gray-400
                                                transition-colors duration-200 cursor-pointer"
                                            >
                                                Очистить
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="max-h-[calc(70vh-180px)] overflow-y-auto pr-2
                                space-y-0.5 custom-scrollbar">
                                    {isLoading ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2
                                            border-blue-600 mb-4"></div>
                                            <p className="text-base text-gray-600
                                            font-medium">
                                                Загрузка категорий...
                                            </p>
                                        </div>
                                    ) : !hasResults && searchTerm ? (
                                        <div className="text-center py-12">
                                            <div className="inline-flex items-center justify-center w-16 h-16
                                            bg-gray-100 rounded-full mb-4 shadow-inner">
                                                <FiSearch className="w-6 h-6 text-gray-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                Ничего не найдено
                                            </h3>
                                            <p className="text-sm text-gray-600">Попробуйте изменить запрос</p>
                                        </div>
                                    ) : filteredCategories.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="inline-flex items-center justify-center w-16 h-16
                                            bg-gray-100 rounded-full mb-4 shadow-inner">
                                                <TbCategory className="w-8 h-8 text-gray-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                Категории отсутствуют
                                            </h3>
                                            <p className="text-sm text-gray-600">В этом каталоге нет категорий</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            {renderCategoryTree(filteredCategories)}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="sticky bottom-0 border-t border-gray-100 bg-gradient-to-r from-gray-50
                    to-white p-4 shadow-md">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600 font-medium">
                                {selectedCategories.length > 0 ? (
                                    <span className="flex items-center gap-1.5">
                                        <FiCheck className="w-4 h-4 text-green-600" />
                                        {selectedCategories.length} категорий выбрано
                                    </span>
                                ) : (
                                    'Выберите категории для фильтрации'
                                )}
                                {appliedMinPrice && (
                                    <span className="ml-2">Дороже {appliedMinPrice} руб</span>
                                )}
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={onClose}
                                    className="px-5 py-2 border border-gray-200 rounded-lg text-gray-700
                                    hover:bg-gray-50 transition-all duration-300 font-semibold
                                    shadow-sm hover:shadow-md"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={selectedCategories.length === 0 || !catalogId}
                                    className={`px-5 py-2 rounded-lg font-semibold transition-all duration-300 
                                    shadow-md hover:shadow-lg ${
                                        selectedCategories.length === 0 || !catalogId
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ' +
                                            'hover:from-blue-700 hover:to-blue-800'
                                    }`}
                                >
                                    Применить
                                    {selectedCategories.length > 0 && (
                                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                                            {selectedCategories.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiltersModal;