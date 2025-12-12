import type { PriceDiff } from '../types/dashboard'
import type { YandexSource } from '../types/types'

export const calcPriceDiff = (
    netLabUsd: number,
    sources: YandexSource[],
    rate: number
): PriceDiff => {
    const netLabRub = netLabUsd * rate;
    const minRub = sources.length ? Math.min(...sources.map(s => s.price)) : 0;
    const diffPercent = minRub ? +(((netLabRub - minRub) / minRub) * 100).toFixed(2) : 0;
    const enriched = sources.map(s => ({
        ...s,
        diffPercent: +(((netLabRub - s.price) / s.price) * 100).toFixed(2)
    }));

    return { netLabRub, yandexSources: enriched, diffPercent };
};