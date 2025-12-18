export interface Catalog {
    id: number;
    name: string;
    categoriesCount: number;
    productsCount: number;
}

export interface Category {
    id: number;
    name: string;
    parent_id: number | null;
    leaf: boolean;
    products: Product[];
    children: Category[];
}

export interface CategoryOnly {
    id: number;
    name: string;
    parent_id: number;
    leaf: boolean;
    children: CategoryOnly[];
}

export interface Product {
    id: number;
    netlab_id: number;
    availableKurskaya: number;
    availableTransit: number;
    availableKaluzhskaya: number;
    availableLobnenskaya: number;
    guarantee: string;
    manufacturer: string;
    isDiscontinued: boolean;
    isDeleted: boolean;
    priceCategoryN: number;
    priceCategoryF: number;
    priceCategoryE: number;
    priceCategoryD: number;
    priceCategoryC: number;
    priceCategoryB: number;
    priceCategoryA: number;
    rrc: number;
    volume: number;
    weight: number;
    tax: string;
    part_number: string;
    name: string;
    traceable_good: number;
    category_id: number;
    yandex_sources: YandexSource[];
}

export type PriceField =
    | 'priceCategoryN'
    | 'priceCategoryF'
    | 'priceCategoryE'
    | 'priceCategoryD'
    | 'priceCategoryC'
    | 'priceCategoryB'
    | 'priceCategoryA';

export interface PriceType {
    id: number;
    name: string;
    value: PriceField;
}

export interface YandexSource {
    id: number;
    retail_price: number;
    legal_entities_price: number;
    url: string;
    source_name: string;
}

export interface YandexParseResponse {
    id: number;
    retail_price: number | null;
    legal_entities_price: number | null;
    before_discount_price: number | null;
    url: string;
    source_name: string;
}

export interface SpecificCategoryResponse {
    id: number;
    name: string;
    parent_id: number | null;
    leaf: boolean;
    products: Product[];
}

export type SpecificCategoriesResponse = SpecificCategoryResponse[];

export type CategoryStats = {
    category_id: number;
    total_products: number;
    has_yandex_sources: number;
    products_with_yandex?: number;
};

export interface CategoriesStatsRequest {
    category_ids: number[];
}

export interface CategoriesByPriceRequest {
    catalog_id: number;
    rub_cost: number;
    exchange_rate: number;
    price_type: PriceField;
    category_ids: number[];
}

export interface CategoryPriceFilterResponse {
    category_id: number;
    category_name: string;
    products_count: number;
    products_with_yandex: number;
}

export interface ProductsByPriceRequest {
    catalog_id: number;
    rub_cost: number;
    exchange_rate: number;
    price_type: PriceField;
    products_with_yandex: number;
    category_ids: number[];
}