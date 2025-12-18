import React, { useState, useEffect, useRef } from 'react'
import { FiChevronDown, FiLoader, FiX, FiDollarSign, FiGrid, FiSearch } from 'react-icons/fi'
import { TbCategory } from 'react-icons/tb'
import type { PriceType, Catalog, PriceField, CategoryOnly } from '../types/types'
import { apiService } from '../services/apiService'

interface HeaderProps {
    onFilterChange: (selectedCategories: number[], minPrice: number | null) => void;
    onPriceTypeChange?: (priceType: PriceField) => void;
    onCatalogChange?: (catalogId: number) => void;
    onExchangeRateChange?: (rate: number) => void;
    selectedCategories: number[];
    selectedCatalog: number | null;
}

const Header: React.FC<HeaderProps> = ({
                                           onFilterChange,
                                           onPriceTypeChange,
                                           onCatalogChange,
                                           onExchangeRateChange,
                                           selectedCategories,
                                           selectedCatalog
                                       }) => {
    const [, setExchangeRate] = useState<number>(80);
    const [selectedPriceType, setSelectedPriceType] = useState<PriceField>('priceCategoryA');
    const [isPriceDropdownOpen, setIsPriceDropdownOpen] = useState(false);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [priceTypes, setPriceTypes] = useState<PriceType[]>([]);
    const [loading, setLoading] = useState({
        catalogs: true,
        priceTypes: true,
        categories: false
    });
    const [error, setError] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const priceDropdownRef = useRef<HTMLDivElement>(null);
    const [rateRaw, setRateRaw] = useState('80');
    const [categories, setCategories] = useState<CategoryOnly[]>([]);
    const [filteredCategories, setFilteredCategories] = useState<CategoryOnly[]>([]);
    const [localSelectedCategories, setLocalSelectedCategories] = useState<number[]>(selectedCategories);
    const [categorySearchTerm, setCategorySearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [minPriceInput, setMinPriceInput] = useState('');

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            if (priceDropdownRef.current && !priceDropdownRef.current.contains(target)) {
                setIsPriceDropdownOpen(false);
            }

            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
                setIsCategoryDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchCatalogs = async () => {
            try {
                setLoading(prev => ({ ...prev, catalogs: true }));
                const data = await apiService.getCatalogs();
                setCatalogs(data);

                if (data.length > 0 && !selectedCatalog) {
                    onCatalogChange?.(data[0].id);
                }
            } catch (err) {
                setError('Ошибка загрузки каталогов');
                console.error('Error fetching catalogs:', err);
            } finally {
                setLoading(prev => ({ ...prev, catalogs: false }));
            }
        };

        void fetchCatalogs();
    }, [onCatalogChange, selectedCatalog]);

    useEffect(() => {
        const fetchPriceTypes = async () => {
            try {
                setLoading(prev => ({ ...prev, priceTypes: true }));

                const staticPriceTypes: PriceType[] = [
                    { id: 1, name: 'Цена A', value: 'priceCategoryA' },
                    { id: 2, name: 'Цена B', value: 'priceCategoryB' },
                    { id: 3, name: 'Цена C', value: 'priceCategoryC' },
                    { id: 4, name: 'Цена D', value: 'priceCategoryD' },
                    { id: 5, name: 'Цена E', value: 'priceCategoryE' },
                    { id: 6, name: 'Цена F', value: 'priceCategoryF' },
                    { id: 7, name: 'Цена N', value: 'priceCategoryN' },
                ];

                setPriceTypes(staticPriceTypes);
            } catch (err) {
                setError('Ошибка загрузки типов цен');
                console.error('Error fetching price types:', err);
            } finally {
                setLoading(prev => ({ ...prev, priceTypes: false }));
            }
        };

        void fetchPriceTypes();
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            if (!selectedCatalog) {
                setCategories([]);
                setFilteredCategories([]);
                return;
            }

            const catalog = catalogs.find(c => c.id === selectedCatalog);
            if (!catalog) return;

            try {
                setLoading(prev => ({ ...prev, categories: true }));
                const response = await apiService.getCategoriesByCatalog(catalog.name);
                setCategories(response);
                setFilteredCategories(response);

                // Автоматически разворачиваем корневые категории
                const rootIds = response
                    .filter(cat => cat?.parent_id === null)
                    .map(cat => cat.id);
                setExpandedCategories(rootIds);
            } catch (err) {
                console.error('Error fetching categories:', err);
            } finally {
                setLoading(prev => ({ ...prev, categories: false }));
            }
        };

        void fetchCategories();
    }, [selectedCatalog, catalogs]);

    useEffect(() => {
        if (!categorySearchTerm.trim()) {
            setFilteredCategories(categories);
            return;
        }

        const searchLower = categorySearchTerm.toLowerCase();
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

        searchInTree(categories);

        if (parentsToExpand.size > 0) {
            setExpandedCategories(prev => [
                ...new Set([...prev, ...Array.from(parentsToExpand)])
            ]);
        }

        setFilteredCategories(results);
    }, [categorySearchTerm, categories]);

    const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        if (!/^\d*\.?\d*$/.test(val)) return;

        const dots = val.split('').filter(c => c === '.').length;
        if (dots > 1) return;

        setRateRaw(val);
    };

    const commitRate = () => {
        const num = parseFloat(rateRaw);
        const valid = Number.isFinite(num) && num >= 0 ? num : 0;
        setRateRaw(valid.toString());
        setExchangeRate(valid);
        onExchangeRateChange?.(valid);
    };

    const handleCatalogClick = (catalogId: number) => {
        onCatalogChange?.(catalogId);
        setLocalSelectedCategories([]);
        setIsCategoryDropdownOpen(false);
        setCategorySearchTerm('');
        setIsMobileMenuOpen(false);
    };

    const handlePriceTypeSelect = (priceType: PriceType) => {
        setSelectedPriceType(priceType.value);
        setIsPriceDropdownOpen(false);
        onPriceTypeChange?.(priceType.value);
    };

    const toggleCategorySelection = (categoryId: number) => {
        setLocalSelectedCategories(prev => {
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

    const toggleCategoryExpand = (categoryId: number) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleApplyFilters = () => {
        const minPrice = minPriceInput.trim() ? parseFloat(minPriceInput) : null;
        onFilterChange(localSelectedCategories, minPrice);
        setIsCategoryDropdownOpen(false);
        setCategorySearchTerm('');
    };

    const handleClearAll = () => {
        setLocalSelectedCategories([]);
        setMinPriceInput('');
        onFilterChange([], null);
    };

    const handleSelectAllCategories = () => {
        const allLeafIds = getAllLeafCategoryIds(categories);
        const limitedIds = allLeafIds.slice(0, 10);
        setLocalSelectedCategories(limitedIds);

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

    const renderCategoryTree = (categories: CategoryOnly[] = [], level = 0) => {
        if (!categories || categories.length === 0) return null;

        return categories.map(category => {
            if (!category) return null;

            const isExpanded = expandedCategories.includes(category.id);
            const isSelected = localSelectedCategories.includes(category.id);
            const hasChildren = category.children?.length > 0;
            const isLeaf = category.leaf || !hasChildren;

            return (
                <div key={category.id} className="mb-1">
                    <div className="flex items-center">
                        <div style={{ width: `${level * 20}px` }} />

                        {hasChildren ? (
                            <button
                                onClick={() => toggleCategoryExpand(category.id)}
                                className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-gray-800
                                hover:bg-gray-100 rounded-full transition mr-1"
                            >
                                <svg
                                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ) : (
                            <div className="w-6" />
                        )}

                        <button
                            onClick={() => isLeaf && toggleCategorySelection(category.id)}
                            disabled={!isLeaf}
                            className={`flex-1 text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                                isSelected
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : isLeaf
                                        ? 'text-gray-700 hover:bg-gray-100'
                                        : 'text-gray-500 cursor-default'
                            }`}
                        >
                            <div className="flex items-center">
                                {isSelected && (
                                    <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                    </div>
                                )}
                                <span className="truncate">{category.name}</span>
                                {hasChildren && !isLeaf && (
                                    <span className="ml-2 text-xs text-gray-500">
                                        ({category.children!.length})
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>

                    {hasChildren && isExpanded && category.children && (
                        <div className="mt-1">
                            {renderCategoryTree(category.children, level + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    if (error && loading.catalogs) {
        return (
            <div className="fixed top-3 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-red-500
            to-red-600 text-white px-4 py-2 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2">
                    <FiX className="w-4 h-4" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <header className={`fixed top-3 left-1/2 transform -translate-x-1/2 z-50 transition-all 
            duration-200 ease-out ${
                isScrolled ? 'scale-[0.98] opacity-100' : 'scale-100 opacity-100'
            }`}>
                <div className={`w-[96vw] max-w-6xl rounded-xl bg-white/90 backdrop-blur-xl shadow-xl border border-gray-200 ${
                    isScrolled ? 'shadow-2xl' : 'shadow-xl'
                } transition-all duration-300 ease-out`}>
                    {/* Desktop Header */}
                    <div className="hidden md:block">
                        <div className="px-6 py-3">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    {/* Курс доллара */}
                                    <div className="flex items-center bg-white rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
                                        <FiDollarSign className="w-4 h-4 text-green-600 mr-2" />
                                        <div className="relative">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={rateRaw}
                                                onChange={handleExchangeRateChange}
                                                onBlur={commitRate}
                                                onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                                                className="w-16 pl-1 pr-6 py-1 text-sm bg-transparent border-none
                                                focus:outline-none focus:ring-0 font-bold text-gray-900"
                                                step="0.01"
                                                min="0"
                                            />
                                            <span className="absolute right-0 top-1/2 transform -translate-y-1/2
                                            text-sm text-gray-500 font-medium">
                                                ₽
                                            </span>
                                        </div>
                                    </div>

                                    {/* Табы с каталогами */}
                                    <div className="flex-1 max-w-2xl">
                                        <div className="flex items-center space-x-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                            {loading.catalogs ? (
                                                <div className="flex-1 flex justify-center py-2">
                                                    <div className="animate-spin rounded-full h-5 w-5
                                                    border-b-2 border-blue-600" />
                                                </div>
                                            ) : (
                                                catalogs.slice(0, 6).map((catalog) => (
                                                    <button
                                                        key={catalog.id}
                                                        onClick={() => handleCatalogClick(catalog.id)}
                                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md 
                                                        transition-all duration-100 whitespace-nowrap cursor-pointer ${
                                                            selectedCatalog === catalog.id
                                                                ? 'bg-white text-gray-900 shadow-sm border border-gray-300'
                                                                : 'text-gray-700 hover:text-gray-900 hover:bg-white/80'
                                                        }`}
                                                        title={catalog.name}
                                                    >
                                                        <span className="truncate block">
                                                            {catalog.name.length > 12
                                                                ? catalog.name.slice(0, 10) + '...'
                                                                : catalog.name
                                                            }
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    {/* Тип цены */}
                                    <div className="relative" ref={priceDropdownRef}>
                                        <button
                                            onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
                                            disabled={loading.priceTypes}
                                            className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg
                                            hover:bg-gray-50 transition-all duration-300 border border-gray-200 shadow-sm text-sm
                                            font-semibold disabled:opacity-50"
                                        >
                                            {loading.priceTypes ? (
                                                <FiLoader className="animate-spin text-gray-500" size={14} />
                                            ) : (
                                                <>
                                                    <TbCategory className="w-4 h-4 text-gray-600" />
                                                    <span className="text-gray-800">
                                                        {priceTypes.find(p =>
                                                            p.value === selectedPriceType)?.name || 'Цена'}
                                                    </span>
                                                    <FiChevronDown
                                                        className={`transition-transform duration-300 
                                                        ${isPriceDropdownOpen ? 'rotate-180' : ''} 
                                                        text-gray-600`}
                                                        size={14}
                                                    />
                                                </>
                                            )}
                                        </button>

                                        {isPriceDropdownOpen && priceTypes.length > 0 && !loading.priceTypes && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl
                                            border border-gray-200 z-20 overflow-hidden">
                                                <div className="py-1">
                                                    {priceTypes.map((priceType) => (
                                                        <button
                                                            key={priceType.id}
                                                            onClick={() => handlePriceTypeSelect(priceType)}
                                                            className={`w-full flex items-center space-x-3 px-4 py-2.5 
                                                            text-sm hover:bg-gray-50 transition-colors duration-200 ${
                                                                selectedPriceType === priceType.value
                                                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                                                    : 'text-gray-800'
                                                            }`}
                                                        >
                                                            <TbCategory className={`w-4 h-4 ${
                                                                selectedPriceType === priceType.value
                                                                    ? 'text-blue-600'
                                                                    : 'text-gray-600'
                                                            }`} />
                                                            <span>{priceType.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Фильтры: категории и цена */}
                            <div className="flex items-center space-x-4">
                                {/* Выбор категорий */}
                                <div className="relative flex-1" ref={categoryDropdownRef}>
                                    <button
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                        disabled={!selectedCatalog}
                                        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg border
                                        transition-all duration-300 text-sm font-medium ${
                                            !selectedCatalog
                                                ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                                                : localSelectedCategories.length > 0
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <TbCategory className="w-4 h-4" />
                                            <span>
                                                {localSelectedCategories.length > 0
                                                    ? `Категории (${localSelectedCategories.length})`
                                                    : 'Выберите категории'}
                                            </span>
                                        </div>
                                        <FiChevronDown
                                            className={`transition-transform duration-300 ${
                                                isCategoryDropdownOpen ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>

                                    {isCategoryDropdownOpen && selectedCatalog && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-lg shadow-xl
                                        border border-gray-200 z-20 overflow-hidden">
                                            <div className="p-3 border-b border-gray-100">
                                                <div className="relative">
                                                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2
                                                    text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        placeholder="Поиск категорий..."
                                                        value={categorySearchTerm}
                                                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                                                        className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-md
                                                        focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                    />
                                                    {categorySearchTerm && (
                                                        <button
                                                            onClick={() => setCategorySearchTerm('')}
                                                            className="absolute right-3 top-1/2 transform -translate-y-1/2
                                                            text-gray-400 hover:text-gray-600"
                                                        >
                                                            <FiX className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="max-h-64 overflow-y-auto p-3">
                                                {loading.categories ? (
                                                    <div className="flex justify-center py-4">
                                                        <div className="animate-spin rounded-full h-6 w-6
                                                        border-b-2 border-blue-600" />
                                                    </div>
                                                ) : filteredCategories.length === 0 ? (
                                                    <div className="text-center py-4 text-sm text-gray-500">
                                                        {categorySearchTerm ? 'Категории не найдены' : 'Категории отсутствуют'}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {renderCategoryTree(filteredCategories)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-3 border-t border-gray-100 bg-gray-50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-sm text-gray-600">
                                                        Выбрано: {localSelectedCategories.length}/10
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={handleSelectAllCategories}
                                                            className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1"
                                                        >
                                                            Выбрать все
                                                        </button>
                                                        <button
                                                            onClick={() => setLocalSelectedCategories([])}
                                                            className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1"
                                                        >
                                                            Очистить
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Фильтр по минимальной цене */}
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="Дороже, руб"
                                            value={minPriceInput}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '' || /^\d+$/.test(val)) {
                                                    setMinPriceInput(val);
                                                }
                                            }}
                                            className="w-40 px-4 py-2 text-sm border border-gray-200 rounded-lg
                                            focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                                            ₽
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleApplyFilters}
                                        disabled={!selectedCatalog}
                                        className="px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm
                                        bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Применить
                                    </button>

                                    {(localSelectedCategories.length > 0 || minPriceInput) && (
                                        <button
                                            onClick={handleClearAll}
                                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800
                                            hover:bg-gray-100 rounded-lg transition-all"
                                        >
                                            Сбросить
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="md:hidden">
                        <div className="p-3">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center bg-white rounded-lg px-3 py-2 border border-gray-200">
                                        <FiDollarSign className="w-3.5 h-3.5 text-green-600 mr-1.5" />
                                        <div className="relative">
                                            <input
                                                value={rateRaw}
                                                onChange={handleExchangeRateChange}
                                                onBlur={commitRate}
                                                onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                                                type="text"
                                                inputMode="decimal"
                                                className="w-14 pl-1 pr-5 py-1 text-sm bg-transparent border-none
                                                focus:outline-none focus:ring-0 font-bold text-gray-900"
                                                step="0.1"
                                                min="0"
                                            />
                                            <span className="absolute right-0 top-1/2 transform -translate-y-1/2
                                            text-sm text-gray-500 font-medium">
                                                ₽
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-all duration-300 shadow-sm border border-gray-200"
                                >
                                    {isMobileMenuOpen ? (
                                        <FiX className="w-4 h-4 text-gray-700" />
                                    ) : (
                                        <FiGrid className="w-4 h-4 text-gray-700" />
                                    )}
                                </button>
                            </div>

                            <div className="flex space-x-1 overflow-x-auto scrollbar-hide mb-2">
                                {loading.catalogs ? (
                                    <div className="flex items-center px-2.5">
                                        <div className="animate-spin rounded-full h-3.5 w-3.5
                                        border-b-2 border-blue-600" />
                                    </div>
                                ) : (
                                    catalogs.slice(0, 4).map((catalog) => (
                                        <button
                                            key={catalog.id}
                                            onClick={() => handleCatalogClick(catalog.id)}
                                            className={`px-2.5 py-1 text-[13px] font-medium rounded-lg 
                                            whitespace-nowrap flex-shrink-0 transition-all duration-300 ${
                                                selectedCatalog === catalog.id
                                                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                                                    : 'text-gray-700 hover:text-blue-600 hover:bg-white'
                                            }`}
                                        >
                                            {catalog.name.length > 8
                                                ? catalog.name.slice(0, 6) + '...'
                                                : catalog.name
                                            }
                                        </button>
                                    ))
                                )}
                            </div>

                            {isMobileMenuOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="space-y-3">
                                        {/* Тип цены для мобильных */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Тип цены
                                            </label>
                                            <select
                                                value={selectedPriceType}
                                                onChange={(e) => {
                                                    const priceType = priceTypes.find(p => p.value === e.target.value);
                                                    if (priceType) {
                                                        handlePriceTypeSelect(priceType);
                                                    }
                                                }}
                                                className="w-full text-sm bg-white border border-gray-200
                                                rounded-lg px-3 py-2 focus:outline-none shadow-sm font-medium text-gray-900"
                                                disabled={loading.priceTypes}
                                            >
                                                {priceTypes.map((priceType) => (
                                                    <option key={priceType.id} value={priceType.value}>
                                                        {priceType.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Фильтр по цене для мобильных */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Минимальная цена
                                            </label>
                                            <div className="flex space-x-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Дороже, руб"
                                                        value={minPriceInput}
                                                        onChange={(e) => setMinPriceInput(e.target.value)}
                                                        className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg
                                                        focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                                        ₽
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Кнопки действий для мобильных */}
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={handleApplyFilters}
                                                disabled={!selectedCatalog}
                                                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all
                                                bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
                                            >
                                                Применить
                                            </button>
                                            {(localSelectedCategories.length > 0 || minPriceInput) && (
                                                <button
                                                    onClick={handleClearAll}
                                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800
                                                    hover:bg-gray-100 rounded-lg transition-all"
                                                >
                                                    Сбросить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="h-28 md:h-32" />
        </>
    );
};

export default Header;