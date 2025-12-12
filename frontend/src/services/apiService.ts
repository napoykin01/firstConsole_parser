import axios, { type AxiosInstance } from 'axios'
import type {Catalog, CatalogDetail, Category, ParseYandexResponse, Product} from '../types/types.ts'

class ApiService {
    private apiClient: AxiosInstance;
    private readonly baseURL: string;

    constructor(baseURL: string = 'http://127.0.0.1:8000/api/v1') {
        this.baseURL = baseURL;

        this.apiClient = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: 10000,
        });

        this.apiClient.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('API Error:', error);
                return Promise.reject(error);
            }
        );
    }

    async getCatalogs(): Promise<Catalog[]> {
        try {
            const response = await this.apiClient.get<Catalog[]>('/catalogs');
            return response.data;
        } catch (error) {
            console.error('Error fetching catalogs:', error);
            throw error;
        }
    }

    async getCatalogDetail(catalogName: string): Promise<CatalogDetail> {
        try {
            const encodedCatalogName = encodeURIComponent(catalogName);
            const response =
                await this.apiClient.get<CatalogDetail>(`/catalog/${encodedCatalogName}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching catalog detail for "${catalogName}":`, error);
            throw error;
        }
    }

    async getAllProductsFromCatalog(catalogName: string): Promise<Product[]> {
        try {
            const catalogDetail = await this.getCatalogDetail(catalogName);
            return this.extractAllProducts(catalogDetail.categories);
        } catch (error) {
            console.error(`Error fetching all products from catalog "${catalogName}":`, error);
            throw error;
        }
    }

    private extractAllProducts(categories: Category[]): Product[] {
        let allProducts: Product[] = [];

        categories.forEach(category => {
            if (category.products && category.products.length > 0) {
                allProducts = [...allProducts, ...category.products];
            }

            if (category.children && category.children.length > 0) {
                const childProducts = this.extractAllProducts(category.children);
                allProducts = [...allProducts, ...childProducts];
            }
        });

        return allProducts;
    }

    async getProductsWithYandexSources(catalogName: string): Promise<Product[]> {
        try {
            const allProducts = await this.getAllProductsFromCatalog(catalogName);
            return allProducts.filter(product =>
                product.yandex_sources && product.yandex_sources.length > 0
            );
        } catch (error) {
            console.error(`Error fetching products with Yandex sources from catalog "${catalogName}":`, error);
            throw error;
        }
    }

    async getTotalProductsCount(catalogName: string): Promise<number> {
        try {
            const allProducts = await this.getAllProductsFromCatalog(catalogName);
            return allProducts.length;
        } catch (error) {
            console.error(`Error getting total products count for catalog "${catalogName}":`, error);
            throw error;
        }
    }

    async getProductsByCategory(categoryId: number): Promise<Product[]> {
        try {
            const response = await this.apiClient.get<Product[]>(`/products_by_category/${categoryId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching products for category ID ${categoryId}:`, error);
            throw error;
        }
    }

    async parseYandexSources(categoryId: number): Promise<ParseYandexResponse> {
        try {
            const response = await this.apiClient.post<ParseYandexResponse>(
                `/parse_yandex/${categoryId}`,
                {},
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            console.log(`Парсинг Яндекс источников для категории ${categoryId} завершен:`, response.data.message);
            return response.data;

        } catch (error) {
            console.error(`Error parsing Yandex sources for category ID ${categoryId}:`, error);
            throw error;
        }
    }

    async parseAndGetProductsWithYandex(categoryId: number, waitForUpdate: boolean = false): Promise<Product[]> {
        try {
            const parseResult = await this.parseYandexSources(categoryId);
            console.log(parseResult.message);

            if (waitForUpdate) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const updatedProducts = await this.getProductsByCategory(categoryId);

            return updatedProducts.filter(product =>
                product.yandex_sources && product.yandex_sources.length > 0
            );

        } catch (error) {
            console.error(`Error in parseAndGetProductsWithYandex for category ID ${categoryId}:`, error);
            throw error;
        }
    }

    async parseAndReturnProducts(categoryId: number): Promise<Product[]> {
        const { data } = await this.apiClient.post<Product[]>(`/parse_and_return/${categoryId}`);
        return data;
    }
}

export const apiService = new ApiService();