import type { Category, Product, YandexSource } from './types'

export interface PriceDiff {
    netLabRub: number;
    yandexSources: YandexSource[];
    diffPercent: number;
}

export interface UiProduct extends Product {
    priceDiff: PriceDiff;
}

export type UiCategory = Omit<Category, 'children' | 'products'> & {
    children?: UiCategory[];
    products?: UiProduct[];
};