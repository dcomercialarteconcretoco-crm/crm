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
    const { settings, sellers, products, productSyncStatus, refreshProducts, updateProduct, deleteProduct, currentUser, addNotification, addAuditLog } = useApp();
    const userIsSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';
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
            addNotification({ title: 'Error al subir imagen', description: json.error || 'No se pudo subir la imagen.', type: 'alert' });
            return null;
        } catch {
            addNotification({ title: 'Error de conexión', description: 'No se pudo subir la imagen. Verifica tu conexión.', type: 'alert' });
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

    const formatSyncTime = (value?: string) => {
        if (!value) return 'Nunca';
        return new Intl.DateTimeFormat('es-CO', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).format(new Date(value));
    };

    useEffect(() => {
        // AppContext handles initial fetch, but we can call it here if needed
        // refreshProducts();
    }, []);

    const getWooFetchHeaders = () => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (settings.wooUrl) h['x-woo-url'] = settings.wooUrl;
        if (settings.wooKey) h['x-woo-key'] = settings.wooKey;
        if (settings.wooSecret) h['x-woo-secret'] = settings.wooSecret;
        return h;
    };

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
                    headers: getWooFetchHeaders(),
                    body: JSON.stringify(payload)
                });
                updateProduct(editingProduct.id, form);
                addAuditLog({
                    userId: currentUser?.id || 'system',
                    userName: currentUser?.name || 'Sistema',
                    userRole: currentUser?.role || 'Admin',
                    action: 'SALE_REGISTERED',
                    targetId: editingProduct.id,
                    targetName: form.name || editingProduct.name,
                    details: `Producto actualizado: precio $${(form.price || 0).toLocaleString('es-CO')}, stock: ${form.isStockTracked ? (form.stock ?? 0) : 'no rastreado'}`,
                    verified: true
                });
            } else {
                const res = await fetch('/api/woocommerce', {
                    method: 'POST',
                    headers: getWooFetchHeaders(),
                    body: JSON.stringify(payload)
                });
                const wooP = await res.json();
                if (wooP && wooP.id) {
                    await refreshProducts();
                } else {
                    addNotification({ title: 'Error WooCommerce', description: 'No se pudo sincronizar. Revisa las credenciales en Configuración → Integraciones API.', type: 'alert' });
                }
            }
            addNotification({ title: 'Sincronización completa', description: 'Producto guardado y sincronizado con WooCommerce.', type: 'success' });
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            addNotification({ title: 'Error de sincronización', description: 'No se pudo conectar con WooCommerce.', type: 'alert' });
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
                        id: values[0]?.trim() || `csv-${Date.now()}-${i}`,
                        name: values[1]?.trim() || 'Producto sin nombre',
                        category: values[2]?.trim() || 'General',
                        sku: values[3]?.trim() || `SKU-${Date.now()}-${i}`,
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
                addNotification({ title: 'CSV inválido', description: 'No se encontraron productos válidos en el archivo CSV. Verifica el formato.', type: 'alert' });
                return;
            }

            // Bulk update logic would need to be moved or implemented here
            addNotification({ title: 'Importación no disponible', description: 'La importación CSV está deshabilitada en modo WooCommerce Sync. Usa el catálogo web.', type: 'alert' });
            e.target.value = '';
        };

        reader.readAsText(file);
    };

    const handleExport = () => {
        if (!canExport) {
            addNotification({ title: 'Acceso denegado', description: 'Solo el Administrador principal puede exportar datos.', type: 'alert' });
            return;
        }

        if (products.length === 0) {
            addNotification({ title: 'Sin productos', description: 'No hay productos para exportar.', type: 'alert' });
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
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">Inventario de Productos</h1>
                    <p className="text-sm text-muted-foreground mt-1">Catálogo de mobiliario de concreto y piezas arquitectónicas.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
                        <span className={clsx(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
                            productSyncStatus.lastResult === 'success'
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : productSyncStatus.lastResult === 'error'
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-muted text-muted-foreground border-border"
                        )}>
                            {productSyncStatus.lastResult === 'success'
                                ? 'Sync OK'
                                : productSyncStatus.lastResult === 'error'
                                    ? 'Sync Error'
                                    : 'Sync pendiente'}
                        </span>
                        <span className="text-muted-foreground">
                            Ultima sync: {formatSyncTime(productSyncStatus.lastSuccessAt || productSyncStatus.lastAttemptAt)}
                        </span>
                        <span className="text-muted-foreground">
                            Items: {productSyncStatus.syncedCount}
                        </span>
                    </div>
                    {productSyncStatus.message && (
                        <p className="mt-2 text-xs text-muted-foreground">{productSyncStatus.message}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleRefresh}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-xs disabled:opacity-50"
                        title="Borra productos manuales y sincroniza con WooCommerce"
                    >
                        <Upload className="w-3.5 h-3.5 rotate-180" />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Catálogo"}
                    </button>
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
                            className="flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-xs"
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            Importar CSV
                        </button>
                    </div>
                    <button
                        onClick={handleExport}
                        className="hidden lg:flex items-center gap-2 bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-xs"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Exportar
                    </button>
                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={clsx(
                            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all border",
                            isFiltersOpen
                                ? "bg-primary text-black border-primary"
                                : "bg-white border-border text-foreground hover:bg-muted"
                        )}
                    >
                        <Search className="w-3.5 h-3.5" />
                        Filtros Avanzados
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {isFiltersOpen && (
                <div className="bg-white border border-border rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Rango de Precio</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={advFilters.minPrice}
                                onChange={(e) => setAdvFilters({ ...advFilters, minPrice: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={advFilters.maxPrice}
                                onChange={(e) => setAdvFilters({ ...advFilters, maxPrice: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Rango de Stock</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={advFilters.minStock}
                                onChange={(e) => setAdvFilters({ ...advFilters, minStock: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={advFilters.maxStock}
                                onChange={(e) => setAdvFilters({ ...advFilters, maxStock: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setAdvFilters({ minPrice: '', maxPrice: '', minStock: '', maxStock: '' })}
                            className="text-xs font-bold text-muted-foreground hover:text-rose-500 transition-colors pb-3"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                </div>
            )}

            {/* View mode tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-4">
                <button
                    onClick={() => { setViewMode('active'); setSelectedProducts([]); }}
                    className={clsx("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", viewMode === 'active' ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted")}
                >Activos</button>
                <button
                    onClick={() => { setViewMode('inactive'); setSelectedProducts([]); }}
                    className={clsx("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", viewMode === 'inactive' ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted")}
                >Inactivos</button>
                <button
                    onClick={() => { setViewMode('deleted'); setSelectedProducts([]); }}
                    className={clsx("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", viewMode === 'deleted' ? "bg-rose-50 text-rose-600 border border-rose-200" : "text-muted-foreground hover:bg-muted")}
                >Papelera</button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Items', value: products.filter(p => !p.isDeleted).length.toString(), icon: Box, dark: true },
                    { label: 'Categorías', value: uniqueCategories.length.toString(), icon: Layers, dark: false },
                    { label: 'Bajo Stock', value: products.filter(p => p.isStockTracked && p.stock < 10).length.toString(), icon: AlertCircle, dark: false },
                    { label: 'Valor Catálogo', value: `$${(products.reduce((acc, p) => acc + p.price, 0) / 1000000).toFixed(1)}M`, icon: BarChart2, dark: false },
                ].map((stat, i) => (
                    <div
                        key={stat.label}
                        className={clsx(
                            "rounded-2xl p-5 flex items-center gap-4",
                            stat.dark
                                ? "bg-foreground text-background"
                                : "bg-white border border-border shadow-sm"
                        )}
                    >
                        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.dark ? "bg-background/10" : "bg-primary/10")}>
                            <stat.icon className={clsx("w-5 h-5", stat.dark ? "text-background" : "text-primary")} />
                        </div>
                        <div>
                            <p className={clsx("text-xs font-bold uppercase tracking-widest", stat.dark ? "text-background/60" : "text-muted-foreground")}>{stat.label}</p>
                            <p className={clsx("text-xl font-black tracking-tight", stat.dark ? "text-background" : "text-foreground")}>{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Card */}
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                {/* Table toolbar */}
                <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, SKU o categoría..."
                                className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                        >
                            <option value="All">Todas las Categorías</option>
                            {uniqueCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    {selectedProducts.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">{selectedProducts.length} Sel.</span>
                            {viewMode === 'active' && (
                                <>
                                    <button onClick={handleBulkDeactivate} className="px-3 py-1.5 bg-white border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors">Desactivar</button>
                                    <button onClick={handleBulkSoftDelete} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">A Papelera</button>
                                </>
                            )}
                            {viewMode === 'inactive' && (
                                <>
                                    <button onClick={handleBulkActivate} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors">Activar</button>
                                    <button onClick={handleBulkSoftDelete} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors">A Papelera</button>
                                </>
                            )}
                            {viewMode === 'deleted' && (
                                <>
                                    <button onClick={handleBulkRestore} className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold hover:bg-sky-100 transition-colors">Restaurar</button>
                                    <button onClick={handleBulkHardDelete} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white border border-red-700 rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors">
                                        {isSyncing ? "..." : "Eliminar Definitivo"}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="w-12 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded accent-primary"
                                        checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Producto / SKU <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('category')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Categoría <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Dimensiones</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('stock')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Stock <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <button onClick={() => handleSort('price')} className="flex items-center gap-1 hover:text-primary transition-colors">
                                        Precio <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((product) => (
                                <tr key={product.id} className={clsx("border-b border-border hover:bg-muted/30 transition-colors group", product.isActive === false && "opacity-50")}>
                                    <td className="w-12 px-4 py-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded accent-primary"
                                            checked={selectedProducts.includes(product.id)}
                                            onChange={() => handleSelectProduct(product.id)}
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png'; (e.target as HTMLImageElement).className = 'w-8 h-8 object-contain opacity-30'; }} />
                                                ) : (
                                                    <img src="https://cuantium.com/wp-content/uploads/2026/02/logo.png" alt="logo" className="w-9 h-9 object-contain opacity-40" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</p>
                                                <p className="text-xs font-mono text-muted-foreground">SKU: {product.sku}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">{product.category}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Ruler className="w-3.5 h-3.5 shrink-0" />
                                            {product.dimensions || '—'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                                            <span className={clsx(
                                                "w-2 h-2 rounded-full shrink-0",
                                                product.isStockTracked ? (product.stock < 10 ? "bg-red-500" : "bg-emerald-500") : "bg-sky-500"
                                            )} />
                                            {product.isStockTracked ? product.stock : 'Ilimitado'}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {product.isStockTracked ? 'Control de Stock' : 'Producción Fábrica'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-primary">${product.price.toLocaleString()}</span>
                                            {product.salePrice && product.salePrice > 0 && (
                                                <span className="text-xs text-red-500 line-through">${product.salePrice.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={clsx(
                                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
                                            product.status === 'In Stock'
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : product.status === 'Production'
                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : "bg-red-50 text-red-700 border-red-200"
                                        )}>
                                            {product.status === 'In Stock' ? 'En Stock' : product.status === 'Production' ? 'En Producción' : 'Sin Stock'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {viewMode === 'deleted' ? (
                                                <>
                                                    <button onClick={() => updateProduct(product.id, { isDeleted: false })} className="p-2 hover:bg-sky-50 hover:text-sky-600 rounded-lg transition-colors" title="Restaurar"><Upload className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(product.id, true)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Eliminar Definitivo"><Trash className="w-4 h-4" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => updateProduct(product.id, { isActive: product.isActive === false ? true : false })} className={clsx("p-2 rounded-lg transition-colors", product.isActive === false ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:bg-muted")} title={product.isActive === false ? "Activar" : "Desactivar"}><Box className="w-4 h-4" /></button>
                                                    <button onClick={() => handleOpenModal(product)} className="p-2 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-muted-foreground" title="Editar"><Edit3 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(product.id, false)} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-muted-foreground" title="Mover a Papelera"><Trash className="w-4 h-4" /></button>
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
                    <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Mostrar</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="bg-muted border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
                            >
                                {[10, 25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span>por página · {filteredProducts.length} total</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">«</button>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">‹</button>
                            {Array.from({ length: Math.min(5, Math.ceil(filteredProducts.length / pageSize)) }, (_, i) => {
                                const totalPages = Math.ceil(filteredProducts.length / pageSize);
                                let page = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage <= 3) page = i + 1;
                                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                                    else page = currentPage - 2 + i;
                                }
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)} className={clsx("w-8 h-8 rounded-lg text-xs font-bold transition-colors", currentPage === page ? "bg-primary text-black" : "text-muted-foreground hover:bg-muted")}>{page}</button>
                                );
                            })}
                            <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / pageSize), p + 1))} disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">›</button>
                            <button onClick={() => setCurrentPage(Math.ceil(filteredProducts.length / pageSize))} disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)} className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">»</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]" style={{ background: 'rgba(10,12,20,0.55)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-black text-foreground">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-muted rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left column */}
                                <div className="space-y-5">
                                    {/* Image Manager */}
                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Imagen Principal</label>
                                        <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-muted border border-border flex items-center justify-center">
                                            {form.image ? (
                                                <>
                                                    <img src={form.image} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://cuantium.com/wp-content/uploads/2026/02/logo.png'; }} />
                                                    <button onClick={() => setForm(f => ({ ...f, image: '' }))} className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-muted-foreground hover:text-red-600 rounded-full transition-colors border border-border">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <img src="https://cuantium.com/wp-content/uploads/2026/02/logo.png" alt="logo" className="w-16 h-16 object-contain opacity-40" />
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={form.image || ''}
                                                onChange={(e) => setForm({ ...form, image: e.target.value })}
                                                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="URL de imagen principal..."
                                            />
                                            <label className={clsx("flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all", isUploading ? "opacity-50 bg-muted border-border text-muted-foreground" : "bg-white border-border text-foreground hover:bg-muted")}>
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
                                        <div className="space-y-2 pt-1">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Galería ({(form.gallery || []).length}/10)</label>
                                                {(form.gallery || []).length < 10 && (
                                                    <label className={clsx("flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all", isUploading ? "opacity-50 bg-muted border-border" : "bg-white border-border text-foreground hover:bg-muted")}>
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
                                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group/gimg">
                                                        <img src={src} alt={`galeria-${idx}`} className="w-full h-full object-cover" />
                                                        <button onClick={() => setForm(f => ({ ...f, gallery: (f.gallery || []).filter((_, i) => i !== idx) }))} className="absolute inset-0 bg-black/50 opacity-0 group-hover/gimg:opacity-100 flex items-center justify-center transition-opacity">
                                                            <X className="w-4 h-4 text-white" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {(form.gallery || []).length < 10 && (
                                                    <label className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary bg-muted flex flex-col items-center justify-center cursor-pointer transition-colors">
                                                        <Plus className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
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

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Nombre del Producto</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all font-semibold"
                                            placeholder="Nombre comercial..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Descripción Corta</label>
                                        <textarea
                                            value={form.shortDescription}
                                            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all h-24 resize-none"
                                            placeholder="Resumen del producto para WooCommerce..."
                                        />
                                    </div>
                                </div>

                                {/* Right column */}
                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">SKU</label>
                                            <input
                                                type="text"
                                                value={form.sku}
                                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Categoría</label>
                                            <input
                                                list="category-options"
                                                value={form.category}
                                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                                placeholder="Ej: Urban"
                                            />
                                            <datalist id="category-options">
                                                {uniqueCategories.map(cat => (
                                                    <option key={cat} value={cat} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Precio Normal</label>
                                            <input
                                                type="number"
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all font-bold text-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Precio Rebajado</label>
                                            <input
                                                type="number"
                                                value={form.salePrice}
                                                onChange={(e) => setForm({ ...form, salePrice: parseFloat(e.target.value) })}
                                                className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all font-bold text-red-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Control de Stock</label>
                                            <div
                                                onClick={() => setForm({ ...form, isStockTracked: !form.isStockTracked })}
                                                className={clsx(
                                                    "w-full rounded-xl px-3 py-2.5 border transition-all cursor-pointer flex items-center justify-between",
                                                    form.isStockTracked ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"
                                                )}
                                            >
                                                <span className="text-xs font-bold uppercase tracking-widest">{form.isStockTracked ? "Activado" : "Ilimitado"}</span>
                                                <div className={clsx(
                                                    "w-4 h-4 rounded-full border transition-all flex items-center justify-center",
                                                    form.isStockTracked ? "bg-primary border-primary" : "border-muted-foreground/40"
                                                )}>
                                                    {form.isStockTracked && <div className="w-2 h-2 bg-black rounded-full" />}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5 opacity-60">Cantidad Stock</label>
                                            <input
                                                type="number"
                                                disabled={!form.isStockTracked}
                                                value={form.stock}
                                                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })}
                                                className={clsx(
                                                    "w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all",
                                                    !form.isStockTracked && "opacity-30"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dimensions + Status row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Dimensiones (cm)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[{ label: 'Alto', val: dimH, set: setDimH }, { label: 'Ancho', val: dimW, set: setDimW }, { label: 'Largo', val: dimD, set: setDimD }].map(({ label, val, set }) => (
                                            <div key={label} className="space-y-1">
                                                <span className="text-xs text-muted-foreground font-bold">{label}</span>
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
                                                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all text-center font-bold"
                                                    placeholder="0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{form.dimensions || 'Sin dimensiones'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Estado de Producción</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                                        className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white transition-all"
                                    >
                                        <option value="In Stock">Disponible Stock</option>
                                        <option value="Production">En Producción</option>
                                        <option value="Out of Stock">No Disponible</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="bg-white border border-border text-foreground font-semibold rounded-xl px-4 py-2.5 hover:bg-muted transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSyncing}
                                className="bg-primary text-black font-bold rounded-xl px-4 py-2.5 hover:brightness-105 transition-all text-sm disabled:opacity-50"
                            >
                                {isSyncing ? "Guardando..." : (editingProduct ? 'Actualizar Producto' : 'Registrar en Catálogo')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
