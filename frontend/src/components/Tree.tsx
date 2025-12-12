import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import type { Catalog, Category, Product } from "../types/types.ts";

interface Props {
    catalog: Catalog;
}

export const Tree: React.FC<Props> = ({ catalog }) => {
    return (
        <div className="w-full text-sm bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-600 rounded"></div>
                    {catalog.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    Всего категорий: {catalog.categories.length}
                </div>
            </div>

            <div className="p-2">
                {catalog.categories.map((cat) => (
                    <CategoryRow key={cat.id} category={cat} depth={0} />
                ))}
            </div>
        </div>
    );
};

const CategoryRow: React.FC<{ category: Category; depth: number }> = ({
                                                                          category,
                                                                          depth,
                                                                      }) => {
    const [open, setOpen] = useState(false);
    const hasChildren = category.children.length > 0;
    const hasProducts = category.products.length > 0;
    const canToggle = hasChildren || hasProducts;

    const toggle = () => {
        if (canToggle) setOpen((o) => !o);
    };

    const indentPx = depth * 20;

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 cursor-pointer transition-all duration-150 rounded-md mx-2 my-1
                    ${canToggle ? "cursor-pointer" : "cursor-default"}
                    ${open ? "bg-gray-50" : ""}`}
                onClick={toggle}
                style={{ paddingLeft: `${indentPx + 12}px` }}
            >
                <span className="text-gray-400 flex-shrink-0">
                    {canToggle ? (
                        open ? (
                            <ChevronDownIcon className="w-4 h-4 transition-transform" />
                        ) : (
                            <ChevronRightIcon className="w-4 h-4 transition-transform" />
                        )
                    ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                        </div>
                    )}
                </span>

                <div className="flex items-center gap-2 flex-grow min-w-0">
                    <span className={`font-medium truncate ${depth === 0 ? "text-gray-900" : "text-gray-700"}`}>
                        {category.name}
                    </span>

                    {hasProducts && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                            {category.products.length}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    {hasChildren && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                            {category.children.length} подкат.
                        </span>
                    )}
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                        {category.products.length} товаров
                    </span>
                </div>
            </div>

            {open && (
                <div className="overflow-hidden animate-fadeIn">
                    {category.products.map((p) => (
                        <ProductRow key={p.id} product={p} depth={depth + 1} />
                    ))}

                    {category.children.map((child) => (
                        <CategoryRow key={child.id} category={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ProductRow: React.FC<{ product: Product; depth: number }> = ({
                                                                       product,
                                                                       depth,
                                                                   }) => {
    const indentPx = depth * 20 + 36;

    return (
        <div
            className="flex items-center py-2 px-3 hover:bg-blue-50 transition-colors duration-150 rounded-md mx-2 my-1 group"
            style={{ paddingLeft: `${indentPx}px` }}
        >
            <div className="flex items-center gap-4 flex-grow min-w-0">
                <div className="flex-1 min-w-0">
                    <div className="text-gray-800 truncate font-medium group-hover:text-blue-700 transition-colors">
                        {product.name}
                    </div>
                    <div className="flex gap-3 mt-1">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {product.part_number}
                        </span>
                        {product.netlab_id && (
                            <span className="text-xs text-gray-500">
                                ID: {product.netlab_id}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                        <div className="font-bold text-gray-900 text-sm">
                            {product.netlab_price.toFixed(2)} $
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            за шт.
                        </div>
                    </div>
                    <div className="w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};