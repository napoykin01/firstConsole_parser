import React, { useState, useEffect } from 'react'
import { Tree } from '../components/Tree'
import { fetchCatalogData } from '../services/api'
import type { Catalog } from '../types/types'

const DashboardPage: React.FC = () => {
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchCatalogData('В наличии');
                setCatalog(data);
            } catch (err) {
                console.error('Failed to load catalog:', err);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    if (loading) return <p className="p-4">Загрузка…</p>;
    if (!catalog)  return <p className="p-4">Не удалось загрузить данные каталога</p>;

    return (
        <div className="App">
            <h1 className="text-xl font-bold p-4">Каталог товаров NetLab</h1>
            <Tree catalog={catalog} />
        </div>
    );
};

export default DashboardPage;