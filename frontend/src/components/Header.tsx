import React, { useState, useEffect, useRef } from 'react'
import { FiFilter, FiChevronDown, FiLoader, FiX, FiDollarSign, FiGrid } from 'react-icons/fi'
import { TbCategory } from 'react-icons/tb'
import type { PriceType, Catalog, PriceField } from '../types/types'
import FiltersModal from './FiltersModal'
import { apiService } from '../services/apiService'

interface HeaderProps {
    onFilterChange?: (selectedCategories: number[]) => void;
    onPriceTypeChange?: (priceType: PriceField) => void;
    onCatalogChange?: (catalogId: number) => void;
    onExchangeRateChange?: (rate: number) => void;
    onAllFiltersChange?: (filters: { categoryIds: number[], exchangeRate: number, priceType: PriceField }) => void;
}

const Header: React.FC<HeaderProps> = ({
                                           onFilterChange,
                                           onPriceTypeChange,
                                           onCatalogChange,
                                           onExchangeRateChange
                                       }) => {
    const [, setExchangeRate] = useState<number>(80);
    const [selectedCatalog, setSelectedCatalog] = useState<number | null>(null);
    const [selectedPriceType, setSelectedPriceType] = useState<PriceField>('priceCategoryA');
    const [isPriceDropdownOpen, setIsPriceDropdownOpen] = useState(false);
    const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [priceTypes, setPriceTypes] = useState<PriceType[]>([]);
    const [loading, setLoading] = useState({
        catalogs: true,
        priceTypes: true
    });
    const [error, setError] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const priceDropdownRef = useRef<HTMLDivElement>(null);
    const [rateRaw, setRateRaw] = useState('80');

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
            const isButtonInsideDropdown = target.closest('button');
            const isInsideDropdown = priceDropdownRef.current?.contains(target);

            if (isInsideDropdown && isButtonInsideDropdown) {
                return;
            }

            if (priceDropdownRef.current && !priceDropdownRef.current.contains(target)) {
                setIsPriceDropdownOpen(false);
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
                    setSelectedCatalog(data[0].id);
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
        setSelectedCatalog(catalogId);
        onCatalogChange?.(catalogId);
        setSelectedCategories([]);
        onFilterChange?.([]);
        setIsMobileMenuOpen(false);
    };

    const handlePriceTypeSelect = (priceType: PriceType) => {
        setSelectedPriceType(priceType.value);
        setIsPriceDropdownOpen(false);
        onPriceTypeChange?.(priceType.value);
    };

    const handleFilterSubmit = (categories: number[]) => {
        setSelectedCategories(categories);
        onFilterChange?.(categories);
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
                <div className={`w-[96vw] max-w-5xl rounded-xl bg-gray-400 backdrop-blur-xl shadow-xl ${
                    isScrolled ? 'shadow-2xl' : 'shadow-xl'
                } transition-all duration-300 ease-out`}>
                    <div className="hidden md:block">
                        <div className="flex items-center justify-between px-6 py-3">
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center bg-gradient-to-r from-gray-50/80
                                to-white/80 rounded-xl px-2 border border-gray-500 shadow-sm
                                backdrop-blur-sm">
                                    <FiDollarSign className="w-3 h-3 text-green-700" />
                                    <div className="flex items-baseline">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={rateRaw}
                                                onChange={handleExchangeRateChange}
                                                onBlur={commitRate}
                                                onKeyDown={(e) => e.key === 'Enter'
                                                    && commitRate()}
                                                className="w-15 pl-4 pr-2 py-1 text-base bg-transparent border-none
                                                focus:outline-none focus:ring-0 font-bold text-black-900"
                                                step="0.01"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="w-px h-8 bg-gray-200/30" />
                            </div>

                            <div className="flex-1 max-w-xl mx-6">
                                <div className="flex items-center space-x-2 bg-gradient-to-r from-gray-50/80
                                to-white/80 rounded-xl p-1.5 shadow-inner border border-gray-500
                                backdrop-blur-sm">
                                    {loading.catalogs ? (
                                        <div className="flex-1 flex justify-center py-2">
                                            <div className="animate-spin rounded-full h-5 w-5
                                            border-b-2 border-blue-600" />
                                        </div>
                                    ) : (
                                        catalogs.slice(0, 5).map((catalog) => (
                                            <button
                                                key={catalog.id}
                                                onClick={() => handleCatalogClick(catalog.id)}
                                                className={`flex-1 px-1 py-1 text-sm font-semibold rounded-lg 
                                                transition-all duration-100 whitespace-nowrap cursor-pointer hover:shadow-md ${
                                                    selectedCatalog === catalog.id
                                                        ? 'bg-white/80 text-gray-700 shadow-md border border-blue-200/50'
                                                        : 'text-gray-700 hover:text-gray-900 hover:bg-white/60'
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
                                    {catalogs.length > 5 && (
                                        <div className="text-sm text-gray-500 font-medium px-3">
                                            +{catalogs.length - 5}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <div className="relative" ref={priceDropdownRef}>
                                    <button
                                        onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
                                        disabled={loading.priceTypes}
                                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl
                                        hover:bg-gray-100/80 transition-all duration-300 border border-gray-100/50 shadow-sm text-sm
                                        font-semibold disabled:opacity-50 hover:shadow-md backdrop-blur-sm cursor-pointer"
                                    >
                                        {loading.priceTypes ? (
                                            <FiLoader className="animate-spin text-gray-500" size={14} />
                                        ) : (
                                            <>
                                                <TbCategory className="w-4 h-4 text-gray-600 cursor-pointer" />
                                                <span className="text-gray-800 cursor-pointer">
                                                    {priceTypes.find(p =>
                                                        p.value === selectedPriceType)?.name || 'Цена'}
                                                </span>
                                                <FiChevronDown
                                                    className={`transition-transform duration-300 
                                                    cursor-pointer ${isPriceDropdownOpen ? 'rotate-180' : ''} 
                                                    text-gray-600`}
                                                    size={14}
                                                />
                                            </>
                                        )}
                                    </button>

                                    {isPriceDropdownOpen && priceTypes.length > 0 && !loading.priceTypes && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white/80 rounded-xl shadow-2xl
                                        border border-gray-100/50 z-20 overflow-hidden transform transition-all duration-300 scale-95 opacity-0 animate-dropdown-open backdrop-blur-lg">
                                            <div className="py-1.5">
                                                {priceTypes.map((priceType) => (
                                                    <button
                                                        key={priceType.id}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={() => {
                                                            handlePriceTypeSelect(priceType);
                                                        }}
                                                        className={`w-full flex items-center space-x-3 px-4 py-2.5 
                                                        text-sm hover:bg-gray-50/80 transition-colors duration-200 cursor-pointer ${
                                                            selectedPriceType === priceType.value
                                                                ? 'bg-blue-50/80 text-blue-700 font-bold'
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

                                <button
                                    onClick={() => setIsFiltersModalOpen(true)}
                                    disabled={!selectedCatalog}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all 
                                    duration-300 text-sm font-semibold cursor-pointer hover:shadow-md ${
                                        selectedCategories.length > 0
                                            ? 'bg-blue-600/90 text-white hover:bg-blue-700 shadow-md backdrop-blur-sm'
                                            : selectedCatalog
                                                ? 'bg-gradient-to-r from-gray-50/80 to-white/80 text-gray-800 hover:bg-gray-100/80 border border-gray-100/50 shadow-sm backdrop-blur-sm'
                                                : 'bg-gray-100/80 text-gray-500 border border-gray-200/50 cursor-not-allowed backdrop-blur-sm'
                                    }`}
                                    title={!selectedCatalog ? "Сначала выберите каталог" : ""}
                                >
                                    <FiFilter size={14} />
                                    <span>Фильтры</span>
                                    {selectedCategories.length > 0 && (
                                        <span className="bg-white/40 text-xs w-5 h-5 rounded-full flex
                                        items-center justify-center font-bold">
                                            {selectedCategories.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block md:hidden">
                        <div className="px-5 py-3">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl px-3 py-1.5 border border-gray-100/50 shadow-sm backdrop-blur-sm">
                                        <FiDollarSign className="w-3.5 h-3.5 text-green-500" />
                                        <div className="relative">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={rateRaw}
                                                onChange={handleExchangeRateChange}
                                                onBlur={commitRate}
                                                onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                                                className="w-16 pl-5 pr-1.5 py-1 text-sm bg-transparent border-none
                                                focus:outline-none focus:ring-0 font-bold text-gray-900"
                                                step="0.1"
                                                min="0"
                                            />
                                            <span className="absolute left-0 top-1/2 transform -translate-y-1/2
                                            text-sm text-gray-500 font-medium">
                                                ₽
                                            </span>
                                        </div>
                                    </div>

                                    <div className="relative" ref={priceDropdownRef}>
                                        <button
                                            onClick={() => setIsPriceDropdownOpen(!isPriceDropdownOpen)}
                                            disabled={loading.priceTypes}
                                            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl
                                            hover:bg-gray-100/80 transition-all duration-300 border border-gray-100/50 shadow-sm
                                            text-sm font-semibold backdrop-blur-sm"
                                        >
                                            <TbCategory className="w-3.5 h-3.5 text-gray-600" />
                                            <FiChevronDown
                                                className={`transition-transform duration-300 ${isPriceDropdownOpen ?
                                                    'rotate-180' : ''}`}
                                                size={12}
                                            />
                                        </button>

                                        {isPriceDropdownOpen && priceTypes.length > 0 && !loading.priceTypes && (
                                            <div className="absolute left-0 mt-2 w-44 bg-white/80 rounded-xl
                                            shadow-2xl border border-gray-100/50 z-20 transform transition-all duration-300 scale-95 opacity-0 animate-dropdown-open backdrop-blur-lg">
                                                <div className="py-1.5">
                                                    {priceTypes.map((priceType) => (
                                                        <button
                                                            key={priceType.id}
                                                            onClick={() => handlePriceTypeSelect(priceType)}
                                                            className={`w-full text-left px-4 py-2.5 text-sm 
                                                            hover:bg-gray-50/80 transition-colors duration-200 ${
                                                                selectedPriceType === priceType.value
                                                                    ? 'bg-blue-50/80 text-blue-700 font-bold'
                                                                    : 'text-gray-800'
                                                            }`}
                                                        >
                                                            {priceType.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsFiltersModalOpen(true)}
                                    disabled={!selectedCatalog}
                                    className={`flex items-center space-x-1.5 px-3 py-1.5 
                                    rounded-xl text-sm font-semibold transition-all duration-300 hover:shadow-md ${
                                        selectedCategories.length > 0
                                            ? 'bg-blue-600/90 text-white hover:bg-blue-700 shadow-md backdrop-blur-sm'
                                            : selectedCatalog
                                                ? 'bg-gradient-to-r from-gray-50/80 to-white/80 text-gray-800 hover:bg-gray-100/80 border border-gray-100/50 shadow-sm backdrop-blur-sm'
                                                : 'bg-gray-100/80 text-gray-500 cursor-not-allowed backdrop-blur-sm'
                                    }`}
                                >
                                    <FiFilter size={12} />
                                    <span>Фильтры</span>
                                    {selectedCategories.length > 0 && (
                                        <span className="bg-white/40 text-[11px] px-1.5 rounded-full font-bold">
                                            {selectedCategories.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            <div className="flex space-x-1.5 overflow-x-auto scrollbar-hide">
                                {loading.catalogs ? (
                                    <div className="flex items-center px-3 py-1.5">
                                        <div className="animate-spin rounded-full h-4 w-4
                                        border-b-2 border-blue-600" />
                                    </div>
                                ) : (
                                    catalogs.slice(0, 6).map((catalog) => (
                                        <button
                                            key={catalog.id}
                                            onClick={() => handleCatalogClick(catalog.id)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-300 hover:shadow-md ${
                                                selectedCatalog === catalog.id
                                                    ? 'bg-white/80 text-blue-700 shadow-md border border-blue-200/50'
                                                    : 'text-gray-700 hover:text-blue-600 hover:bg-white/60'
                                            }`}
                                            title={catalog.name}
                                        >
                                            {catalog.name.length > 10
                                                ? catalog.name.slice(0, 8) + '...'
                                                : catalog.name
                                            }
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="sm:hidden">
                        <div className="px-4 py-2.5">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center space-x-1.5 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl
                                px-2.5 py-1.5 border border-gray-100/50 shadow-sm backdrop-blur-sm">
                                    <FiDollarSign className="w-3 h-3 text-green-500" />
                                    <div className="relative">
                                        <input
                                            value={rateRaw}
                                            onChange={handleExchangeRateChange}
                                            onBlur={commitRate}
                                            onKeyDown={(e) => e.key === 'Enter' && commitRate()}
                                            type="text"
                                            inputMode="decimal"
                                            className="w-14 pl-4 pr-1 py-1 text-sm bg-transparent border-none
                                            focus:outline-none focus:ring-0 font-bold text-gray-900"
                                            step="0.1"
                                            min="0"
                                        />
                                        <span className="absolute left-0 top-1/2 transform -translate-y-1/2
                                        text-sm text-gray-500 font-medium">
                                            ₽
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="p-2 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl hover:bg-gray-100/80 transition-all duration-300 shadow-sm border border-gray-100/50 backdrop-blur-sm"
                                >
                                    {isMobileMenuOpen ? (
                                        <FiX className="w-4 h-4 text-gray-700" />
                                    ) : (
                                        <FiGrid className="w-4 h-4 text-gray-700" />
                                    )}
                                </button>
                            </div>

                            <div className="flex space-x-1 overflow-x-auto scrollbar-hide mb-1.5">
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
                                            whitespace-nowrap flex-shrink-0 transition-all duration-300 hover:shadow-md ${
                                                selectedCatalog === catalog.id
                                                    ? 'bg-white/80 text-blue-700 shadow-md border border-blue-200/50'
                                                    : 'text-gray-700 hover:text-blue-600 hover:bg-white/60'
                                            }`}
                                        >
                                            {catalog.name.length > 8
                                                ? catalog.name.slice(0, 6) + '...'
                                                : catalog.name
                                            }
                                        </button>
                                    ))
                                )}
                                {catalogs.length > 4 && (
                                    <div className="text-[12px] text-gray-500 font-medium px-2 flex items-center">
                                        +{catalogs.length - 4}
                                    </div>
                                )}
                            </div>

                            {isMobileMenuOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-200/30 animate-fadeIn duration-300">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Тип цены
                                            </label>
                                            <select
                                                value={selectedPriceType}
                                                onChange={(e) => {
                                                    const priceType =
                                                        priceTypes.find(p => p.value === e.target.value);
                                                    if (priceType) {
                                                        handlePriceTypeSelect(priceType);
                                                    }
                                                }}
                                                className="w-full text-sm bg-gradient-to-r from-gray-50/80 to-white/80 border border-gray-100/50
                                                rounded-xl px-3 py-2 focus:outline-none shadow-sm font-medium text-gray-900 backdrop-blur-sm"
                                                disabled={loading.priceTypes}
                                            >
                                                {priceTypes.map((priceType) => (
                                                    <option key={priceType.id} value={priceType.value}>
                                                        {priceType.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setIsFiltersModalOpen(true);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            disabled={!selectedCatalog}
                                            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 
                                            rounded-xl text-sm font-semibold transition-all duration-300 hover:shadow-md ${
                                                selectedCategories.length > 0
                                                    ? 'bg-blue-600/90 text-white hover:bg-blue-700 shadow-md backdrop-blur-sm'
                                                    : selectedCatalog
                                                        ? 'bg-gradient-to-r from-gray-50/80 to-white/80 text-gray-800 hover:bg-gray-100/80 border border-gray-100/50 shadow-sm backdrop-blur-sm'
                                                        : 'bg-gray-100/80 text-gray-500 cursor-not-allowed backdrop-blur-sm'
                                            }`}
                                        >
                                            <FiFilter size={14} />
                                            <span>Фильтры</span>
                                            {selectedCategories.length > 0 && (
                                                <span className="bg-white/40 text-[12px] px-1.5 rounded-full font-bold">
                                                    {selectedCategories.length}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="h-20 md:h-24" />

            <FiltersModal
                isOpen={isFiltersModalOpen}
                onClose={() => setIsFiltersModalOpen(false)}
                onSubmit={handleFilterSubmit}
                initialSelectedCategories={selectedCategories}
                catalogId={selectedCatalog}
                exchangeRate={parseFloat(rateRaw) || 0}
                priceType={selectedPriceType}
            />
        </>
    );
};

export default Header;