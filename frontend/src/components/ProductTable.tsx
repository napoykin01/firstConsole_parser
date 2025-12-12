import * as React from "react";
import type { UiProduct } from '../types/dashboard'
import { ExternalLink } from 'lucide-react'

export const ProductTable: React.FC<{ products: UiProduct[] }> = ({ products }) => (
    <div className="overflow-auto">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
            <tr>
                <th className="px-3 py-2 text-left">Товар</th>
                <th className="px-3 py-2 text-right">NetLab, $</th>
                <th className="px-3 py-2 text-right">NetLab, ₽</th>
                <th className="px-3 py-2 text-left">Цены Яндекса (₽)</th>
            </tr>
            </thead>
            <tbody>
            {products.map(p => (
                <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right">{p.netlab_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{p.priceDiff.netLabRub.toFixed(0)}</td>

                    {/* Колонка с источниками и % напротив каждого */}
                    <td className="px-3 py-2">
                        {p.priceDiff.yandexSources.length ? (
                            <ul className="space-y-1">
                                {p.priceDiff.yandexSources.map((s, idx) => (
                                    <li key={idx} className="flex items-center gap-3">
                                        <span className="font-medium">{s.price.toFixed(0)} ₽</span>
                                        <span
                                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                (s.diffPercent ?? 0) >= 0 ? 
                                                    'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                            }`}
                                        >
                                            {((s.diffPercent ?? 0) > 0 ? '+' : '') +
                                                (s.diffPercent ?? 0).toFixed(1)}%
                                        </span>
                                        <a
                                            href={s.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {s.marketplace || 'источник'}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span className="text-gray-400 text-xs">нет данных</span>
                        )}
                    </td>
                </tr>
            ))}
            </tbody>
        </table>
    </div>
);