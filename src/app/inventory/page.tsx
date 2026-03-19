"use client";

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Box,
    Layers,
    AlertCircle,
    ArrowUpDown,
    BarChart2,
    Package,
    Ruler,
    Edit3,
    Trash,
    Download,
    Upload,
    X
} from 'lucide-react';
import { clsx } from 'clsx';

import { useApp, Product } from '@/context/AppContext';

const INITIAL_PRODUCTS: Product[] = [];

export default function InventoryPage() {
    const { settings, sellers, products, refreshProducts, updateProduct, deleteProduct, currentUser } = useApp();
    const userIsSuperAdmin = currentUser?.role === 'SuperAdmin';
    const canExport = userIsSuperAdmin && settings.allowExports;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [form, setForm] = useState<Partial<Product>>({
        name: '',
        category: 'Urban',
        sku: '',
        stock: 0,
        isStockTracked: false,
        price: 0,
        salePrice: 0,
        shortDescription: '',
        dimensions: '',
        status: 'In Stock',
        image: ''
    });

    // Persist every products change is now handled in AppContext
    // React.useEffect(() => { ... }, [products]);

    const uniqueCategories = Array.from(new Set(products.map(p => p.category)));

    const [isSyncing, setIsSyncing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'active' | 'inactive' | 'deleted'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [advFilters, setAdvFilters] = useState({
        minPrice: '',
        maxPrice: '',
        minStock: '',
        maxStock: '',
    });

    // Structured dimension helper state (Alto x Ancho x Largo)
    const [dimH, setDimH] = useState('');
    const [dimW, setDimW] = useState('');
    const [dimD, setDimD] = useState('');

    const parseDims = (dims: string) => {
        // Parse formats like "180x60x45cm" or "Alto:72 cm, Ancho: 80 cm, Largo: 80 cm"
        const simple = dims.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
        if (simple) return { h: simple[1], w: simple[2], d: simple[3] };
        const alto = dims.match(/[Aa]lto[:\s]+(\d+(?:\.\d+)?)/);
        const ancho = dims.match(/[Aa]ncho[:\s]+(\d+(?:\.\d+)?)/);
        const largo = dims.match(/[Ll]argo[:\s]+(\d+(?:\.\d+)?)/);
        return { h: alto?.[1] || '', w: ancho?.[1] || '', d: largo?.[1] || '' };
    };

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setForm(product);
            const d = parseDims(product.dimensions || '');
            setDimH(d.h); setDimW(d.w); setDimD(d.d);
        } else {
            setEditingProduct(null);
            setForm({ name: '', category: 'Urban', sku: '', stock: 0, isStockTracked: false, price: 0, salePrice: 0, shortDescription: '', dimensions: '', status: 'In Stock', image: '', gallery: [] });
            setDimH(''); setDimW(''); setDimD('');
        }
        setIsModalOpen(true);
    };

    // Upload a file to /api/upload, return the public URL
    const uploadFile = async (file: File): Promise<string | null> => {
        setIsUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.url) return json.url;
            alert(json.error || 'Error al subir imagen');
            return null;
        } catch {
            alert('Error de conexión al subir imagen');
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handleRefresh = async () => {
        setIsSyncing(true);
        await refreshProducts();
        setIsSyncing(false);
    };

    useEffect(() => {
        // AppContext handles initial fetch, but we can call it here if needed
        // refreshProducts();
    }, []);

    const handleSave = async () => {
        setIsSyncing(true);
        try {
            const payload = {
                name: form.name,
                regular_price: form.price?.toString(),
                sale_price: form.salePrice?.toString(),
                short_description: form.shortDescription,
                manage_stock: form.isStockTracked,
                stock_quantity: form.stock,
                sku: form.sku,
            };

            if (editingProduct && editingProduct.wooId) {
                await fetch(`/api/woocommerce?id=${editingProduct.wooId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                updateProduct(editingProduct.id, form);
            } else {
                const res = await fetch('/api/woocommerce', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const wooP = await res.json();
                if (wooP && wooP.id) {
                    await refreshProducts(); // Re-fetch to get new product with proper mapping
                } else {
                    // Fallback
                    alert("No se pudo sincronizar con WooCommerce");
                }
            }
            alert("Sincronización automática con WooCommerce completa.");
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Error al sincronizar con WooCommerce.");
            setIsModalOpen(false);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string, hardDelete: boolean = false) => {
        if (hardDelete) {
            if (confirm('¿Estás seguro de eliminar PERMANENTEMENTE este producto? Se borrará automáticamente en WooCommerce.')) {
                const product = products.find(p => p.id === id);
                if (product?.wooId) {
                    try {
                        await fetch(`/api/woocommerce?id=${product.wooId}`, { method: 'DELETE' });
                    } catch (error) {
                        console.error("No se pudo eliminar de woo", error);
                    }
                }
                deleteProduct(id);
                setSelectedProducts(prev => prev.filter(pId => pId !== id));
            }
        } else {
            updateProduct(id, { isDeleted: true });
            setSelectedProducts(prev => prev.filter(pId => pId !== id));
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (!content) return;

            const lines = content.split('\n');
            // Build the list of parsed products from the CSV (no dependency on `products` state here)
            const parsed: Product[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values: string[] = [];
                let inQuotes = false;
                let currentValue = '';
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"' && line[j + 1] === '"') {
                        currentValue += '"'; j++;
                    } else if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(currentValue); currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                values.push(currentValue);

                if (values.length >= 7) {
                    const isTracked = values[5].trim().toLowerCase() === 'sí' || values[5].trim().toLowerCase() === 'si' || values[5].trim() === 'true';

                    let cleanDesc = values[8] || '';
                    cleanDesc = cleanDesc.replace(/<[^>]+>/g, '')
                        .replace(/\\n/g, ' ')
                        .replace(/&nbsp;/ig, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    parsed.push({
                        id: values[0]?.trim() || Math.random().toString().slice(2, 9),
                        name: values[1]?.trim() || 'Producto sin nombre',
                        category: values[2]?.trim() || 'General',
                        sku: values[3]?.trim() || `SKU-${Math.random().toString().slice(2, 6)}`,
                        stock: parseInt(values[4]) || 0,
                        isStockTracked: isTracked,
                        price: parseFloat(values[6]) || 0,
                        salePrice: values[7] ? parseFloat(values[7]) : undefined,
                        shortDescription: cleanDesc,
                        dimensions: values[9]?.trim() || '',
                        status: (values[10]?.trim() as 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Production') || 'In Stock',
                        wooId: values[11] ? parseInt(values[11]) : undefined,
                        image: values[12]?.trim() || ''
                    });
                }
            }

            if (parsed.length === 0) {
                alert('No se encontraron productos válidos en el archivo CSV.');
                return;
            }

            // Bulk update logic would need to be moved or implemented here
            alert("Acción de importación deshabilitada temporalmente en modo WooCommerce Sync.");
            e.target.value = '';
        };

        reader.readAsText(file);
    };

    const handleExport = () => {
        if (!canExport) {
            alert("Acceso denegado: Solo el Administrador principal puede exportar datos o la función está desactivada por seguridad.");
            return;
        }

        if (products.length === 0) {
            alert("No hay productos para exportar.");
            return;
        }

        const headers = ['ID', 'Nombre', 'Categoria', 'SKU', 'Stock', 'Maneja Stock', 'Precio', 'Precio Rebajado', 'Descripcion', 'Dimensiones', 'Estado', 'WooID', 'Imagen'];
        const rows = products.filter(p => viewMode === 'deleted' ? p.isDeleted : !p.isDeleted).map(p => [
            p.id,
            `"${p.name.replace(/"/g, '""')}"`,
            p.category,
            `"${p.sku}"`,
            p.stock,
            p.isStockTracked ? 'Sí' : 'No',
            p.price,
            p.salePrice || '',
            `"${(p.shortDescription || '').replace(/"/g, '""')}"`,
            `"${(p.dimensions || '').replace(/"/g, '""')}"`,
            p.status,
            p.wooId || '',
            `"${(p.image || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `productos_inventario.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredProducts = products.filter(p => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query);

        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

        const matchesPrice = (!advFilters.minPrice || p.price >= parseFloat(advFilters.minPrice)) &&
            (!advFilters.maxPrice || p.price <= parseFloat(advFilters.maxPrice));

        const matchesStock = (!advFilters.minStock || p.stock >= parseInt(advFilters.minStock)) &&
            (!advFilters.maxStock || p.stock <= parseInt(advFilters.maxStock));

        let matchesStatus = false;
        if (viewMode === 'active') matchesStatus = !p.isDeleted && p.isActive !== false;
        if (viewMode === 'inactive') matchesStatus = !p.isDeleted && p.isActive === false;
        if (viewMode === 'deleted') matchesStatus = !!p.isDeleted;

        return matchesSearch && matchesCategory && matchesPrice && matchesStock && matchesStatus;
    }).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const valA = a[key] || '';
        const valB = b[key] || '';

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedProducts(filteredProducts.map(p => p.id));
        else setSelectedProducts([]);
    };

    const handleSelectProduct = (id: string) => {
        setSelectedProducts(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const handleBulkSoftDelete = () => {
        if (!confirm(`¿Mover ${selectedProducts.length} productos a la papelera?`)) return;
        selectedProducts.forEach(id => updateProduct(id, { isDeleted: true }));
        setSelectedProducts([]);
    };

    const handleBulkRestore = () => {
        selectedProducts.forEach(id => updateProduct(id, { isDeleted: false }));
        setSelectedProducts([]);
    };

    const handleBulkDeactivate = () => {
        selectedProducts.forEach(id => updateProduct(id, { isActive: false }));
        setSelectedProducts([]);
    };

    const handleBulkActivate = () => {
        selectedProducts.forEach(id => updateProduct(id, { isActive: true }));
        setSelectedProducts([]);
    };

    const handleBulkHardDelete = async () => {
        if (!confirm(`¿Eliminar PERMANENTEMENTE ${selectedProducts.length} productos?\nEsto borrará localmente los productos seleccionados y en WooCommerce (si están vinculados). No se puede deshacer.`)) return;
        setIsSyncing(true);
        try {
            const productsToDelete = products.filter(p => selectedProducts.includes(p.id));
            await Promise.all(productsToDelete.map(async (p) => {
                if (p.wooId) {
                    try { await fetch(`/api/woocommerce?id=${p.wooId}`, { method: 'DELETE' }); } catch (e) { }
                }
            }));
            await refreshProducts();
            setSelectedProducts([]);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Inventario de Productos</h1>
                    <p className="text-sm text-muted-foreground">Catálogo de mobiliario de concreto y piezas arquitectónicas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all text-primary shadow-lg shadow-primary/5 disabled:opacity-50"
                            title="Borra productos manuales y sincroniza con WooCommerce"
                        >
                            <Upload className="w-3.5 h-3.5 rotate-180" />
                            {isSyncing ? "Sincronizando..." : "Sincronizar Catálogo Web"}
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            id="csv-import"
                            className="hidden"
                            accept=".csv"
                            onChange={handleImport}
                        />
                        <button
                            onClick={() => document.getElementById('csv-import')?.click()}
                            className="flex items-center gap-2 px-4 py-2 border border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 transition-all text-muted-foreground"
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            Importar CSV
                        </button>
                    </div>
                    <button onClick={handleExport} className="hidden lg:flex items-center gap-2 px-4 py-2 border border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-muted/50 transition-colors text-muted-foreground">
                        <Download className="w-3.5 h-3.5" />
                        Exportar
                    </button>
                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            isFiltersOpen ? "bg-primary text-black border-primary shadow-lg shadow-primary/10" : "border-border/40 hover:bg-muted/50 text-muted-foreground"
                        )}
                    >
                        <Search className="w-3.5 h-3.5" />
                        Filtros Avanzados
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Producto</span>
                    </button>
                </div>
            </div>

            {isFiltersOpen && (
                <div className="bg-card border border-border/40 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Rango de Precio</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={advFilters.minPrice}
                                onChange={(e) => setAdvFilters({ ...advFilters, minPrice: e.target.value })}
                                className="w-full bg-muted/10 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all text-white font-bold"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={advFilters.maxPrice}
                                onChange={(e) => setAdvFilters({ ...advFilters, maxPrice: e.target.value })}
                                className="w-full bg-muted/10 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all text-white font-bold"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Rango de Stock</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={advFilters.minStock}
                                onChange={(e) => setAdvFilters({ ...advFilters, minStock: e.target.value })}
                                className="w-full bg-muted/10 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all text-white font-bold"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={advFilters.maxStock}
                                onChange={(e) => setAdvFilters({ ...advFilters, maxStock: e.target.value })}
                                className="w-full bg-muted/10 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all text-white font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setAdvFilters({ minPrice: '', maxPrice: '', minStock: '', maxStock: '' })}
                            className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 transition-colors pb-3"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2 border-b border-border/40 pb-4">
                <button onClick={() => { setViewMode('active'); setSelectedProducts([]); }} className={clsx("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", viewMode === 'active' ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50")}>Activos</button>
                <button onClick={() => { setViewMode('inactive'); setSelectedProducts([]); }} className={clsx("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", viewMode === 'inactive' ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted/50")}>Inactivos</button>
                <button onClick={() => { setViewMode('deleted'); setSelectedProducts([]); }} className={clsx("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", viewMode === 'deleted' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "text-muted-foreground hover:bg-muted/50")}>Papelera</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Items', value: products.filter(p => !p.isDeleted).length.toString(), icon: Box, color: 'text-primary' },
                    { label: 'Categorías', value: uniqueCategories.length.toString(), icon: Layers, color: 'text-sky-500' },
                    { label: 'Bajo Stock', value: products.filter(p => p.isStockTracked && p.stock < 10).length.toString(), icon: AlertCircle, color: 'text-rose-500' },
                    { label: 'Valor Catálogo', value: `$${(products.reduce((acc, p) => acc + p.price, 0) / 1000000).toFixed(1)}M`, icon: BarChart2, color: 'text-emerald-500' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-card border border-border/40 p-4 rounded-xl flex items-center gap-4 group hover:border-primary/20 transition-all">
                        <div className={`p-2.5 rounded-2xl bg-muted/50 ${stat.color} group-hover:bg-primary/10 group-hover:text-primary transition-all`}>
                            <stat.icon size={20} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{stat.label}</p>
                            <p className="text-lg font-black tracking-tighter">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, SKU o categoría..."
                                className="w-full bg-muted/10 border border-border/40 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-muted/10 border border-border/40 rounded-lg px-3 py-2 text-xs font-bold focus:border-primary outline-none"
                        >
                            <option value="All">Todas las Categorías</option>
                            {uniqueCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    {selectedProducts.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">{selectedProducts.length} Sel.</span>
                            {viewMode === 'active' && (
                                <>
                                    <button onClick={handleBulkDeactivate} className="px-3 py-1.5 bg-muted/20 border border-border/40 rounded-lg text-[10px] font-bold uppercase hover:bg-muted/50 transition-colors">Desactivar</button>
                                    <button onClick={handleBulkSoftDelete} className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase hover:bg-rose-500 hover:text-white transition-colors">A Papelera</button>
                                </>
                            )}
                            {viewMode === 'inactive' && (
                                <>
                                    <button onClick={handleBulkActivate} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-500 hover:text-white transition-colors">Activar</button>
                                    <button onClick={handleBulkSoftDelete} className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase hover:bg-rose-500 hover:text-white transition-colors">A Papelera</button>
                                </>
                            )}
                            {viewMode === 'deleted' && (
                                <>
                                    <button onClick={handleBulkRestore} className="px-3 py-1.5 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-lg text-[10px] font-bold uppercase hover:bg-sky-500 hover:text-white transition-colors">Restaurar</button>
                                    <button onClick={handleBulkHardDelete} className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white border border-rose-600 rounded-lg text-[10px] font-bold uppercase hover:bg-rose-600 transition-colors">
                                        {isSyncing ? "..." : "Eliminar Definitivo"}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/5">
                                <th className="w-12 px-6 py-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-border/40 bg-muted/20 text-primary focus:ring-primary accent-primary"
                                        checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Producto / SKU
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Categoría
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dimensiones</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('stock')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Stock
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('price')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Precio
                                        <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((product) => (
                                <tr key={product.id} className={clsx("hover:bg-muted/5 transition-colors group", product.isActive === false && "opacity-50")}>
                                    <td className="w-12 px-6 py-5">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border/40 bg-muted/20 text-primary focus:ring-primary accent-primary"
                                            checked={selectedProducts.includes(product.id)}
                                            onChange={() => handleSelectProduct(product.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center text-muted-foreground border border-border/40 overflow-hidden relative group/img">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" onError={(e) => { (e.target as HTMLImageElement).src = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png'; (e.target as HTMLImageElement).className = 'w-8 h-8 object-contain opacity-30 filter invert'; }} />
                                                ) : (
                                                    <img src="https://cuantium.com/wp-content/uploads/2026/02/logo.png" alt="logo" className="w-11 h-11 object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black group-hover:text-primary transition-colors tracking-tight">{product.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">SKU:</span>
                                                    <p className="text-[9px] font-mono text-muted-foreground bg-muted/5 px-1.5 py-0.5 rounded border border-white/5">{product.sku}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/20">{product.category}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Ruler className="w-3.5 h-3.5" />
                                            {product.dimensions}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
                                            <span className={clsx(
                                                "w-1.5 h-1.5 rounded-full",
                                                product.isStockTracked ? (product.stock < 10 ? "bg-rose-500" : "bg-emerald-500") : "bg-sky-500 animate-pulse"
                                            )}></span>
                                            {product.isStockTracked ? product.stock : 'Ilimitado'}
                                        </div>
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-30">
                                            {product.isStockTracked ? 'Control de Stock' : 'Producción Fábrica'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-primary tracking-tighter">${product.price.toLocaleString()}</span>
                                            {product.salePrice && product.salePrice > 0 && (
                                                <span className="text-[9px] font-bold text-rose-500 line-through opacity-50">${product.salePrice.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={clsx(
                                            "text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm",
                                            product.status === 'In Stock' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                product.status === 'Production' ? "bg-primary/10 text-primary border-primary/20" :
                                                    "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                        )}>
                                            {product.status === 'In Stock' ? 'En Stock' : product.status === 'Production' ? 'En Producción' : 'Sin Stock'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {viewMode === 'deleted' ? (
                                                <>
                                                    <button onClick={() => updateProduct(product.id, { isDeleted: false })} className="p-2 hover:bg-sky-500/10 hover:text-sky-500 rounded-lg transition-colors border border-transparent hover:border-sky-500/20" title="Restaurar"><Upload className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(product.id, true)} className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-500/20" title="Eliminar Definitivo"><Trash className="w-4 h-4" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => updateProduct(product.id, { isActive: product.isActive === false ? true : false })} className={clsx("p-2 rounded-lg transition-colors border border-transparent", product.isActive === false ? "hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20 text-emerald-500" : "hover:bg-muted/50 hover:border-border/40")} title={product.isActive === false ? "Activar" : "Desactivar"}><Box className="w-4 h-4" /></button>
                                                    <button onClick={() => handleOpenModal(product)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors border border-transparent hover:border-primary/20" title="Editar"><Edit3 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(product.id, false)} className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-500/20" title="Mover a Papelera"><Trash className="w-4 h-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {filteredProducts.length > 0 && (
                    <div className="p-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Mostrar</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="bg-muted/20 border border-border/40 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-primary outline-none"
                            >
                                {[10, 25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span>por página · {filteredProducts.length} total</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">«</button>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">‹</button>
                            {Array.from({ length: Math.min(5, Math.ceil(filteredProducts.length / pageSize)) }, (_, i) => {
                                const totalPages = Math.ceil(filteredProducts.length / pageSize);
                                let page = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage <= 3) page = i + 1;
                                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                                    else page = currentPage - 2 + i;
                                }
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)} className={clsx("w-8 h-8 rounded-lg text-xs font-bold transition-colors", currentPage === page ? "bg-primary text-black" : "text-muted-foreground hover:bg-muted/50")}>{page}</button>
                                );
                            })}
                            <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / pageSize), p + 1))} disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">›</button>
                            <button onClick={() => setCurrentPage(Math.ceil(filteredProducts.length / pageSize))} disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">»</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card border border-border/40 w-full max-w-2xl rounded-[2.5rem] p-8 lg:p-10 shadow-3xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto scrollbar-hide">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>

                        <h2 className="text-xl font-bold mb-8">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                {/* ===== IMAGE MANAGER ===== */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Imagen Principal</label>
                                    {/* Main image preview */}
                                    <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-muted/20 border border-border/40 flex items-center justify-center group">
                                        {form.image ? (
                                            <>
                                                <img src={form.image} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png'; }} />
                                                <button onClick={() => setForm(f => ({ ...f, image: '' }))} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-500 text-white rounded-full transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </>
                                        ) : (
                                            <img src="https://cuantium.com/wp-content/uploads/2026/02/logo.png" alt="logo" className="w-20 h-20 object-contain opacity-60" />
                                        )}
                                    </div>
                                    {/* Upload + URL row */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={form.image || ''}
                                            onChange={(e) => setForm({ ...form, image: e.target.value })}
                                            className="flex-1 bg-muted/20 border border-border/40 rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-all"
                                            placeholder="URL de imagen principal..."
                                        />
                                        <label className={clsx("flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all", isUploading ? "opacity-50 bg-muted/20 border-border/40" : "bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-black")}>
                                            {isUploading ? <ArrowUpDown className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                            {isUploading ? '...' : 'Subir'}
                                            <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const url = await uploadFile(file);
                                                if (url) setForm(f => ({ ...f, image: url }));
                                                e.target.value = '';
                                            }} />
                                        </label>
                                    </div>

                                    {/* Gallery */}
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Galería ({(form.gallery || []).length}/10)</label>
                                            {(form.gallery || []).length < 10 && (
                                                <label className={clsx("flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all", isUploading ? "opacity-50" : "bg-muted/20 border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30")}>
                                                    <Plus className="w-3 h-3" />
                                                    Agregar
                                                    <input type="file" className="hidden" accept="image/*" multiple disabled={isUploading} onChange={async (e) => {
                                                        const files = Array.from(e.target.files || []);
                                                        const currentGallery = form.gallery || [];
                                                        const slots = 10 - currentGallery.length;
                                                        const toUpload = files.slice(0, slots);
                                                        const urls: string[] = [];
                                                        for (const file of toUpload) {
                                                            const url = await uploadFile(file);
                                                            if (url) urls.push(url);
                                                        }
                                                        if (urls.length) setForm(f => ({ ...f, gallery: [...(f.gallery || []), ...urls] }));
                                                        e.target.value = '';
                                                    }} />
                                                </label>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-5 gap-2">
                                            {(form.gallery || []).map((src, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted/20 border border-border/40 group/gimg">
                                                    <img src={src} alt={`galeria-${idx}`} className="w-full h-full object-cover" />
                                                    <button onClick={() => setForm(f => ({ ...f, gallery: (f.gallery || []).filter((_, i) => i !== idx) }))} className="absolute inset-0 bg-black/60 opacity-0 group-hover/gimg:opacity-100 flex items-center justify-center transition-opacity">
                                                        <X className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(form.gallery || []).length < 10 && (
                                                <label className="aspect-square rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 bg-muted/10 flex flex-col items-center justify-center cursor-pointer transition-colors group/add">
                                                    <Plus className="w-5 h-5 text-muted-foreground group-hover/add:text-primary transition-colors" />
                                                    <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const url = await uploadFile(file);
                                                        if (url) setForm(f => ({ ...f, gallery: [...(f.gallery || []), url] }));
                                                        e.target.value = '';
                                                    }} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Nombre del Producto</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all font-bold"
                                        placeholder="Nombre comercial..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Descripción Corta</label>
                                    <textarea
                                        value={form.shortDescription}
                                        onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                                        className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all h-24 resize-none"
                                        placeholder="Resumen del producto para WooCommerce..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">SKU</label>
                                        <input
                                            type="text"
                                            value={form.sku}
                                            onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                            className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Categoría</label>
                                        <input
                                            list="category-options"
                                            value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                                            className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all"
                                            placeholder="Ej: Urban"
                                        />
                                        <datalist id="category-options">
                                            {uniqueCategories.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Precio Normal</label>
                                        <input
                                            type="number"
                                            value={form.price}
                                            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                                            className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all font-black text-primary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Precio Rebajado</label>
                                        <input
                                            type="number"
                                            value={form.salePrice}
                                            onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) })}
                                            className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all font-black text-rose-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Control de Stock</label>
                                        <div
                                            onClick={() => setForm({ ...form, isStockTracked: !form.isStockTracked })}
                                            className={clsx(
                                                "w-full rounded-2xl px-5 py-4 border transition-all cursor-pointer flex items-center justify-between",
                                                form.isStockTracked ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/20 border-border/40 text-muted-foreground"
                                            )}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest">{form.isStockTracked ? "Activado" : "Ilimitado"}</span>
                                            <div className={clsx(
                                                "w-4 h-4 rounded-full border transition-all flex items-center justify-center",
                                                form.isStockTracked ? "bg-primary border-primary" : "border-muted-foreground/40"
                                            )}>
                                                {form.isStockTracked && <div className="w-2 h-2 bg-black rounded-full" />}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1 opacity-50">Cantidad Stock</label>
                                        <input
                                            type="number"
                                            disabled={!form.isStockTracked}
                                            value={form.stock}
                                            onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })}
                                            className={clsx(
                                                "w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all",
                                                !form.isStockTracked && "opacity-20"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Dimensiones (cm)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[{ label: 'Alto', val: dimH, set: setDimH }, { label: 'Ancho', val: dimW, set: setDimW }, { label: 'Largo', val: dimD, set: setDimD }].map(({ label, val, set }) => (
                                        <div key={label} className="space-y-1">
                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest pl-1 opacity-60">{label}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={val}
                                                onChange={(e) => {
                                                    set(e.target.value);
                                                    const newH = label === 'Alto' ? e.target.value : dimH;
                                                    const newW = label === 'Ancho' ? e.target.value : dimW;
                                                    const newD = label === 'Largo' ? e.target.value : dimD;
                                                    if (newH || newW || newD) setForm(f => ({ ...f, dimensions: `${newH || 0}x${newW || 0}x${newD || 0}cm` }));
                                                }}
                                                className="w-full bg-muted/20 border border-border/40 rounded-xl px-3 py-3 text-sm focus:border-primary outline-none transition-all text-center font-bold"
                                                placeholder="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[9px] text-muted-foreground opacity-40 pl-1">{form.dimensions || 'Sin dimensiones'}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Estado de Producción</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                                    className="w-full bg-muted/20 border border-border/40 rounded-2xl px-5 py-4 text-sm focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="In Stock">Disponible Stock</option>
                                    <option value="Production">En Producción</option>
                                    <option value="Out of Stock">No Disponible</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button
                                onClick={handleSave}
                                disabled={isSyncing}
                                className="w-full bg-primary text-black font-black py-5 rounded-[1.5rem] hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSyncing ? "GUARDANDO Y SINCRONIZANDO..." : (editingProduct ? 'ACTUALIZAR PRODUCTO' : 'REGISTRAR EN CATÁLOGO')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
