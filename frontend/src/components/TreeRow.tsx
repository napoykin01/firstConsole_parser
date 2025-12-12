import * as React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { UiCategory } from '../types/dashboard'

type Props = {
    depth: number;
    category: UiCategory;
    onToggle: () => void;
    loading: boolean;
    expanded: boolean;
};

export const TreeRow: React.FC<Props> = ({ depth, category, onToggle, loading, expanded }) => (
    <div
        className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded cursor-pointer select-none"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        onClick={onToggle}
    >
        {category.children?.length || category.products?.length ? (
            expanded && !loading ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
        ) : null}
        <span className="text-sm text-gray-800">{category.name}</span>
        {loading && <span className="text-xs text-gray-400 ml-2">обновление…</span>}
    </div>
);