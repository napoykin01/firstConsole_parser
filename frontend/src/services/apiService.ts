import axios, { type AxiosInstance } from 'axios'
import type {
    Catalog, CategoriesStatsRequest,
    CategoryOnly, CategoryStats,
    SpecificCategoriesResponse,
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
            timeout: 5000,
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
        catalogName: string,
        categoryIds: number[]
    ): Promise<SpecificCategoriesResponse> {
        try {
            const params = new URLSearchParams();
            categoryIds.forEach(id => {
                params.append('category_ids', id.toString());
            });

            const response = await this.apiClient.post<SpecificCategoriesResponse>(
                `/public/get-specific-categories-with-products/${encodeURIComponent(catalogName)}`,
                {},
                {
                    params: params
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching specific categories with products:', error);
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
}

export const apiService = new ApiService();