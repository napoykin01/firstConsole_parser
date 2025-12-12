export interface Catalog {
    name: string;
}

export interface ParseYandexResponse {
    message: string;
}

export interface YandexSource {
    url: string;
    price: number;
    marketplace?: string;
    diffPercent?: number;
}

export interface Product {
    id: number;
    netlab_id: number;
    part_number: string;
    name: string;
    netlab_price: number;
    yandex_sources: YandexSource[];
}

export interface Category {
    id: number;
    name: string;
    parent_id: number;
    leaf: boolean;
    children: Category[];
    products: Product[];
}

export interface CatalogDetail {
    id: number;
    name: string;
    categories: Category[];
}