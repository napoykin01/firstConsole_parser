import * as React from 'react'
import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService'
import { TreeRow } from '../components/TreeRow'
import { ProductTable } from '../components/ProductTable'
import { useCategoryToggle } from '../hooks/useCategoryToggle'
import { calcPriceDiff } from '../utils/priceUtils'
import type { Catalog, Category } from '../types/types'
import type { UiCategory } from '../types/dashboard'

const buildUiTree = (cats: Category[], rate: number): UiCategory[] =>
    cats.map((c) => ({
        ...c,
        children: c.children ? buildUiTree(c.children, rate) : undefined,
        products: c.products?.map((p) => ({
            ...p,
            priceDiff: calcPriceDiff(p.netlab_price, p.yandex_sources ?? [], rate),
        })),
    }));

export const Dashboard: React.FC = () => {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
    const [tree, setTree] = useState<UiCategory[]>([]);
    const [rate, setRate] = useState<number>(90);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [parsed, setParsed] = useState<Record<number, boolean>>({});

    const { toggle, loading } = useCategoryToggle(rate);

    useEffect(() => {
        apiService.getCatalogs().then(setCatalogs);
    }, []);

    useEffect(() => {
        if (!selectedCatalog) return;
        apiService
            .getCatalogDetail(selectedCatalog.name)
            .then(detail => setTree(buildUiTree(detail.categories, rate)));
    }, [selectedCatalog, rate]);

    const handleToggle = async (cat: UiCategory) => {
        const isExpanded = expanded[cat.id];
        setExpanded((o) => ({ ...o, [cat.id]: !isExpanded }));

        if (!isExpanded && !parsed[cat.id]) {
            await toggle(cat, (upd) => replaceInTree(upd));
            setParsed(o => ({ ...o, [cat.id]: true }));
        }
    };

    const replaceInTree = (upd: UiCategory) =>
        setTree((prev) => walkAndReplace(prev, upd, rate));

    const walkAndReplace = (nodes: UiCategory[], target: UiCategory, rate: number): UiCategory[] =>
        nodes.map((n) =>
            n.id === target.id
                ? {
                    ...target,
                    products: target.products?.map(p => ({
                        ...p,
                        priceDiff: calcPriceDiff(p.netlab_price, p.yandex_sources ?? [], rate),
                    })),
                }
                : { ...n, children: n.children ? walkAndReplace(n.children, target, rate) : undefined }
        );

    return (
        <div className="max-w-svw mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-semibold text-gray-800">Сравнение цен</h1>

            <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">Курс USD/₽</label>
                <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded"
                />
            </div>

            <div className="flex gap-2">
                {catalogs.map((c) => (
                    <button
                        key={c.name}
                        onClick={() => setSelectedCatalog(c)}
                        className={`px-3 py-1.5 rounded text-sm ${selectedCatalog?.name === c.name ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            <section className="bg-white rounded-lg shadow-sm border">
                <div className="p-3 border-b text-gray-500 text-sm">Категории / товары</div>
                <div className="p-2 space-y-1">
                    {tree.map((node) => (
                        <CategoryNode
                            key={node.id}
                            cat={node}
                            depth={0}
                            expanded={expanded}
                            loading={loading}
                            parsed={parsed}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

const CategoryNode: React.FC<{
    cat: UiCategory;
    depth: number;
    expanded: Record<number, boolean>;
    loading: Record<number, boolean>;
    parsed: Record<number, boolean>;
    onToggle: (c: UiCategory) => void;
}> = ({ cat, depth, expanded, loading, parsed, onToggle }) => {
    const isExpanded = expanded[cat.id];
    const isLoading = loading[cat.id];

    return (
        <>
            <TreeRow
                depth={depth}
                category={cat}
                expanded={isExpanded}
                loading={isLoading}
                onToggle={() => onToggle(cat)}
            />
            {isExpanded && cat.products && <ProductTable products={cat.products} />}
            {isExpanded &&
                cat.children?.map((ch) => (
                    <CategoryNode
                        key={ch.id}
                        cat={ch}
                        depth={depth + 1}
                        expanded={expanded}
                        loading={loading}
                        parsed={parsed}
                        onToggle={onToggle}
                    />
                ))}
        </>
    );
};