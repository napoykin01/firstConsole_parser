import { useState } from 'react';
import { apiService } from '../services/apiService';
import { calcPriceDiff } from '../utils/priceUtils';
import type { UiCategory, UiProduct } from '../types/dashboard';

export const useCategoryToggle = (rate: number) => {
    const [loading, setLoading] = useState<Record<number, boolean>>({});

    const toggle = async (cat: UiCategory, onUpdate: (upd: UiCategory) => void) => {
        if (loading[cat.id]) return;

        setLoading(o => ({ ...o, [cat.id]: true }));
        try {
            const freshProducts = await apiService.parseAndReturnProducts(cat.id);

            const uiProducts: UiProduct[] = freshProducts.map(p => ({
                ...p,
                priceDiff: calcPriceDiff(p.netlab_price, p.yandex_sources ?? [], rate),
            }));

            onUpdate({ ...cat, products: uiProducts });
        } finally {
            setLoading(o => ({ ...o, [cat.id]: false }));
        }
    };

    return { toggle, loading };
};