import React from 'react';
import {
    FiPackage,
    FiBarChart2,
    FiDollarSign,
    FiRefreshCw,
    FiGrid,
    FiFilter
} from 'react-icons/fi';
import { TbCategory, TbCurrencyDollar } from 'react-icons/tb';
import type { Product, Category } from '../types/types';

interface StatsPanelProps {
    products: Product[];
    categories: Category[];
    selectedCategories: number[];
    exchangeRate: number;
    selectedPriceType: string;
    catalogName: string;
    updatingProducts: Set<number>;
    updatingCategories: Set<number>;
    loading: boolean;
}

// Выносим компонент ProgressBar наружу, чтобы не создавать его внутри render
const ProgressBar: React.FC<{
    value: number;
    max?: number;
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}> = ({ value, max = 100, color = 'blue' }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClasses = {
        blue: 'bg-gradient-to-r from-blue-600 to-cyan-600',
        green: 'bg-gradient-to-r from-green-600 to-emerald-600',
        yellow: 'bg-gradient-to-r from-yellow-600 to-amber-600',
        red: 'bg-gradient-to-r from-red-600 to-rose-600',
        purple: 'bg-gradient-to-r from-purple-600 to-fuchsia-600'
    };

    return (
        <div className="w-full bg-gray-200/50 rounded-full h-2.5 overflow-hidden shadow-inner">
            <div
                className={`h-full rounded-full ${colorClasses[color]} transition-all duration-700 ease-out transform scale-x-0 origin-left group-hover:scale-x-100`}
                style={{ width: `${percentage}%`, transitionProperty: 'width, transform' }}
            />
        </div>
    );
};

const StatsPanel: React.FC<StatsPanelProps> = ({
                                                   products,
                                                   categories,
                                                   selectedCategories,
                                                   exchangeRate,
                                                   selectedPriceType,
                                                   catalogName,
                                                   updatingProducts,
                                                   updatingCategories,
                                                   loading
                                               }) => {
    const calculateStats = () => {
        const totalProducts = products.length;
        const productsWithYandexData = products.filter(p =>
            p.yandex_sources && p.yandex_sources.length > 0
        ).length;

        const productsWithPriceData = products.filter(p =>
            p.yandex_sources &&
            p.yandex_sources.length > 0 &&
            p.yandex_sources[0].retail_price &&
            p.rrc > 0
        );

        const coveragePercentage = totalProducts > 0
            ? (productsWithYandexData / totalProducts) * 100
            : 0;

        let avgPriceDifference = 0;
        if (productsWithPriceData.length > 0) {
            const totalPercent = productsWithPriceData.reduce((sum, p) => {
                const rrc = p.rrc || 0;
                const retailPrice = p.yandex_sources[0].retail_price || 0;
                if (rrc === 0) return sum;
                return sum + ((retailPrice - rrc) / rrc) * 100;
            }, 0);
            avgPriceDifference = totalPercent / productsWithPriceData.length;
        }

        const aboveRrcCount = productsWithPriceData.filter(p => {
            const rrc = p.rrc || 0;
            const retailPrice = p.yandex_sources[0].retail_price || 0;
            return retailPrice > rrc;
        }).length;

        const aboveRrcPercentage = productsWithPriceData.length > 0
            ? (aboveRrcCount / productsWithPriceData.length) * 100
            : 0;

        const totalSources = products.reduce((sum, p) =>
            sum + (p.yandex_sources?.length || 0), 0
        );

        const avgSourcesPerProduct = productsWithYandexData > 0
            ? totalSources / productsWithYandexData
            : 0;

        let minPriceDifference = 0;
        let maxPriceDifference = 0;

        if (productsWithPriceData.length > 0) {
            const percentages = productsWithPriceData.map(p => {
                const rrc = p.rrc || 0;
                const retailPrice = p.yandex_sources[0].retail_price || 0;
                if (rrc === 0) return 0;
                return ((retailPrice - rrc) / rrc) * 100;
            });

            minPriceDifference = Math.min(...percentages);
            maxPriceDifference = Math.max(...percentages);
        }

        return {
            totalProducts,
            productsWithYandexData,
            productsWithPriceData: productsWithPriceData.length,
            coveragePercentage,
            avgPriceDifference,
            aboveRrcPercentage,
            avgSourcesPerProduct,
            minPriceDifference,
            maxPriceDifference,
            totalCategories: categories.length,
            selectedCategoriesCount: selectedCategories.length
        };
    };

    const stats = calculateStats();

    const getColorClass = (value: number, type: 'coverage' | 'difference' | 'percentage') => {
        if (type === 'coverage') {
            if (value >= 80) return 'from-green-600 to-emerald-700';
            if (value >= 50) return 'from-yellow-600 to-amber-700';
            return 'from-red-600 to-rose-700';
        }

        if (type === 'difference') {
            if (value > 10) return 'from-green-600 to-emerald-700';
            if (value > 0) return 'from-green-500 to-green-600';
            if (value < -10) return 'from-red-600 to-rose-700';
            if (value < 0) return 'from-red-500 to-red-600';
            return 'from-gray-600 to-gray-700';
        }

        if (value >= 50) return 'from-blue-600 to-cyan-700';
        return 'from-blue-500 to-blue-600';
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden transform transition-all duration-300 hover:shadow-xl">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-md">
                            <FiBarChart2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Статистика анализа</h2>
                            <p className="text-sm text-gray-600 mt-0.5">Динамический обзор цен и покрытия данных</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                        <FiRefreshCw className="w-4 h-4 animate-spin-slow" />
                        <span>Обновлено: {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Левая колонка - Общая статистика */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <FiGrid className="w-5 h-5 text-blue-600" />
                                Общие показатели
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600 font-medium">Товары всего</div>
                                        <div className="p-2 bg-blue-50 rounded-xl transition-colors duration-300 group-hover:bg-blue-100">
                                            <FiPackage className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{stats.totalProducts}</div>
                                    <div className="text-xs text-gray-500 mt-1.5">в выбранных категориях</div>
                                </div>

                                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600 font-medium">Категории</div>
                                        <div className="p-2 bg-green-50 rounded-xl transition-colors duration-300 group-hover:bg-green-100">
                                            <TbCategory className="w-5 h-5 text-green-600" />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {stats.selectedCategoriesCount}
                                        <span className="text-2xl font-medium text-gray-500">/{stats.totalCategories}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1.5">выбрано из доступных</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <FiFilter className="w-5 h-5 text-purple-600" />
                                Покрытие данными
                            </h3>
                            <div className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <div className="text-sm text-gray-600 font-medium">Данные Яндекс</div>
                                        <div className="text-3xl font-bold text-gray-900 mt-1">
                                            {stats.coveragePercentage.toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${getColorClass(stats.coveragePercentage, 'coverage')} shadow-md transition-transform duration-300 group-hover:scale-105`}>
                                        <FiBarChart2 className="w-7 h-7 text-white" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="group">
                                        <div className="flex justify-between text-sm text-gray-600 font-medium mb-1.5">
                                            <span>С данными: {stats.productsWithYandexData}</span>
                                            <span>Без данных: {stats.totalProducts - stats.productsWithYandexData}</span>
                                        </div>
                                        <ProgressBar
                                            value={stats.coveragePercentage}
                                            color={
                                                stats.coveragePercentage >= 80 ? 'green' :
                                                    stats.coveragePercentage >= 50 ? 'yellow' : 'red'
                                            }
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex justify-between text-sm text-gray-600 font-medium mb-1.5">
                                            <span>Среднее количество источников:</span>
                                            <span className="font-bold">{stats.avgSourcesPerProduct.toFixed(1)}</span>
                                        </div>
                                        <ProgressBar
                                            value={stats.avgSourcesPerProduct * 10}
                                            color="purple"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Правая колонка - Анализ цен */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <TbCurrencyDollar className="w-5 h-5 text-green-600" />
                                Анализ ценовой конкуренции
                            </h3>
                            <div className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                <div className="grid grid-cols-3 gap-5 mb-6">
                                    <div className="text-center p-3 rounded-xl bg-gray-50/50 transition-colors duration-300 group-hover:bg-gray-100">
                                        <div className="text-sm text-gray-600 font-medium mb-1">Средний %</div>
                                        <div className={`text-2xl font-bold ${
                                            stats.avgPriceDifference > 0 ? 'text-green-600' :
                                                stats.avgPriceDifference < 0 ? 'text-red-600' : 'text-gray-600'
                                        }`}>
                                            {stats.avgPriceDifference > 0 ? '+' : ''}{stats.avgPriceDifference.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">превышения</div>
                                    </div>

                                    <div className="text-center p-3 rounded-xl bg-gray-50/50 transition-colors duration-300 group-hover:bg-gray-100">
                                        <div className="text-sm text-gray-600 font-medium mb-1">Минимум</div>
                                        <div className={`text-2xl font-bold ${
                                            stats.minPriceDifference > 0 ? 'text-green-600' :
                                                stats.minPriceDifference < 0 ? 'text-red-600' : 'text-gray-600'
                                        }`}>
                                            {stats.minPriceDifference > 0 ? '+' : ''}{stats.minPriceDifference.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">самое низкое</div>
                                    </div>

                                    <div className="text-center p-3 rounded-xl bg-gray-50/50 transition-colors duration-300 group-hover:bg-gray-100">
                                        <div className="text-sm text-gray-600 font-medium mb-1">Максимум</div>
                                        <div className={`text-2xl font-bold ${
                                            stats.maxPriceDifference > 0 ? 'text-green-600' :
                                                stats.maxPriceDifference < 0 ? 'text-red-600' : 'text-gray-600'
                                        }`}>
                                            {stats.maxPriceDifference > 0 ? '+' : ''}{stats.maxPriceDifference.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">самое высокое</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="group">
                                        <div className="flex justify-between text-sm text-gray-600 font-medium mb-1.5">
                                            <span>Товаров с превышением РРЦ: {stats.aboveRrcPercentage.toFixed(1)}%</span>
                                            <span className="font-bold">
                                                {Math.round(stats.productsWithPriceData * stats.aboveRrcPercentage / 100)}/{stats.productsWithPriceData}
                                            </span>
                                        </div>
                                        <ProgressBar
                                            value={stats.aboveRrcPercentage}
                                            color={stats.aboveRrcPercentage > 50 ? 'green' : 'blue'}
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="text-sm text-gray-600 font-medium mb-2">Диапазон ценовых отклонений</div>
                                        <div className="relative h-2.5 bg-gray-200/50 rounded-full overflow-hidden shadow-inner">
                                            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-yellow-600 to-green-600 opacity-80" />
                                            <div
                                                className="absolute top-0 w-1.5 h-5 -mt-1 bg-white rounded-full shadow-md border border-gray-300 transition-all duration-300 group-hover:scale-110"
                                                style={{ left: `calc(${((stats.minPriceDifference + 50) / 100) * 100}% - 0.375rem)` }}
                                            />
                                            <div
                                                className="absolute top-0 w-1.5 h-5 -mt-1 bg-white rounded-full shadow-md border border-gray-300 transition-all duration-300 group-hover:scale-110"
                                                style={{ left: `calc(${((stats.maxPriceDifference + 50) / 100) * 100}% - 0.375rem)` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                                            <span>-50%</span>
                                            <span>0%</span>
                                            <span>+50%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <FiRefreshCw className="w-5 h-5 text-orange-600" />
                                Системные показатели
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600 font-medium">Курс USD</div>
                                        <div className="p-2 bg-green-50 rounded-xl transition-colors duration-300 group-hover:bg-green-100">
                                            <FiDollarSign className="w-5 h-5 text-green-600" />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">{exchangeRate.toFixed(2)} ₽</div>
                                    <div className="text-xs text-gray-500 mt-1.5">актуальный курс</div>
                                </div>

                                <div className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-600 font-medium">Тип цены</div>
                                        <div className="p-2 bg-blue-50 rounded-xl transition-colors duration-300 group-hover:bg-blue-100">
                                            <TbCategory className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900">
                                        {selectedPriceType.replace('priceCategory', 'Кат. ')}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1.5">используется для расчётов</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Нижняя панель - Индикаторы состояния */}
                <div className="mt-6 pt-5 border-t border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full shadow-md ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                                <span className="text-sm text-gray-600 font-medium">
                                    {loading ? 'Загрузка данных...' : 'Данные загружены'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full shadow-md ${updatingProducts.size > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
                                <span className="text-sm text-gray-600 font-medium">
                                    Обновляется товаров: {updatingProducts.size}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full shadow-md ${updatingCategories.size > 0 ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`} />
                                <span className="text-sm text-gray-600 font-medium">
                                    Обновляется категорий: {updatingCategories.size}
                                </span>
                            </div>
                        </div>

                        <div className="text-sm text-gray-500 font-medium">
                            Каталог: <span className="text-gray-900">{catalogName}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsPanel;