import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1';

export const fetchCatalogData = async (catalogName: string) => {
    const response = await axios.get(`${API_BASE}/catalog/${encodeURIComponent(catalogName)}`);
    return response.data;
};