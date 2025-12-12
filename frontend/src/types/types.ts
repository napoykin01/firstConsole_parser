export interface Product {
    id: number;
    netlab_id: number;
    part_number: string;
    name: string;
    netlab_price: number;
}

export interface Category {
    id: number;
    name: string;
    parent_id: number | null;
    leaf: boolean;
    children: Category[];
    products: Product[];
}

export interface Catalog {
    id: number;
    name: string;
    categories: Category[];
}