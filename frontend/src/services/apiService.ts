import axios, { type AxiosInstance } from 'axios'
import type {
    Catalog, CategoriesByPriceRequest, CategoriesStatsRequest,
    CategoryOnly, CategoryPriceFilterResponse, CategoryStats, Product, ProductsByPriceRequest,
    SpecificCategoriesResponse, UnifiedFilterCategoriesResponse, UnifiedFilterRequest,
    YandexParseResponse
} from '../types/types'

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
            timeout: 30000,
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
            const response
                = await this.apiClient.get<Catalog[]>('/public/get-catalogs');
            return response.data;
        } catch (error) {
            console.error('Error fetching catalogs:', error);
            throw error;
        }
    }

    async getCategoriesByCatalog(catalogName: string): Promise<CategoryOnly[]> {
        try {
            const response
                = await this.apiClient.get<CategoryOnly[]>
            (`/public/get-categories/${catalogName}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    }

    async parseYandexPartNumber(partNumber: string): Promise<YandexParseResponse[]> {
        try {
            const encodedPartNumber = encodeURIComponent(partNumber);
            console.log('Making parse request for:', partNumber, 'encoded:', encodedPartNumber);

            const response = await this.apiClient.post<YandexParseResponse[]>(
                `/yandex-search/search/async/${encodedPartNumber}`
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching Yandex parse data:', error);
            if (axios.isAxiosError(error)) {
                console.error('Parse error details:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.response?.data?.detail || error.message
                });
            }
            throw error;
        }
    }

    async getSpecificCategoriesWithProducts(
        catalogId: number,
        categoryIds: number[] = []
    ): Promise<SpecificCategoriesResponse> {
        try {
            if (categoryIds.length === 0) {
                console.warn('Empty categoryIds array, skipping API call');
                return [];
            }

            console.log('Sending API request with:', {
                catalogId,
                categoryIds,
                url: `/public/get-specific-categories-with-products/${catalogId}`,
            });

            const data = {
                category_ids: categoryIds
            };

            const response = await this.apiClient.post<SpecificCategoriesResponse>(
                `/public/get-specific-categories-with-products/${catalogId}`,
                data,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            console.log('API Response:', {
                status: response.status,
                dataLength: response.data?.length || 0
            });

            return response.data;
        } catch (error) {
            console.error('Error in getSpecificCategoriesWithProducts:', error);
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;
                console.error('Server error details:', {
                    status: error.response?.status,
                    detail: errorData?.detail || errorData?.message || errorData,
                    url: error.config?.url,
                    dataSent: error.config?.data,
                });

                if (error.response?.status === 400 &&
                    errorData?.detail === "Список category_ids не может быть пустым") {
                    console.warn('Backend rejected empty category_ids');
                    return [];
                }
            }
            throw error;
        }
    }

    async getCategoriesStats(
        catalogName: string,
        categoryIds: number[]
    ): Promise<CategoryStats[]> {
        try {
            const requestData: CategoriesStatsRequest = {
                category_ids: [...new Set(categoryIds)]
            };

            const response = await this.apiClient.post<CategoryStats[]>(
                `/public/get-categories-stats/${encodeURIComponent(catalogName)}`,
                requestData
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching categories stats:', error);
            if (axios.isAxiosError(error)) {
                console.error('Error details:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    config: {
                        url: error.config?.url,
                        method: error.config?.method,
                        params: error.config?.params,
                        data: error.config?.data
                    }
                });
            }
            throw error;
        }
    }

    async filterCategoriesByPrice(
        payload: CategoriesByPriceRequest
    ): Promise<CategoryPriceFilterResponse[]> {
        try {
            const response = await this.apiClient.post<CategoryPriceFilterResponse[]>(
                '/public/filter/categories-by-price',
                payload
            );
            return response.data;
        } catch (error) {
            console.error('Error filtering categories by price:', error);
            if (axios.isAxiosError(error)) {
                console.error('Error details:', {
                    status: error.response?.status,
                    data: error.response?.data,
                });
            }
            throw error;
        }
    }

    async filterProductsByPrice(
        payload: ProductsByPriceRequest
    ): Promise<Product[]> {
        try {
            const response = await this.apiClient.post<Product[]>(
                '/public/filter/products-by-price',
                payload
            );
            return response.data;
        } catch (error) {
            console.error('Error filtering products by price:', error);
            if (axios.isAxiosError(error)) {
                console.error('Error details:', {
                    status: error.response?.status,
                    data: error.response?.data,
                });
            }
            throw error;
        }
    }

    async unifiedFilter(
        payload: UnifiedFilterRequest
    ): Promise<UnifiedFilterCategoriesResponse> {
        const { data } = await this.apiClient.post<UnifiedFilterCategoriesResponse>(
            '/public/unified-filter',
            payload
        );
        return data;
    }
}

export const apiService = new ApiService();