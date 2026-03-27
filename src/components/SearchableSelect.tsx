"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Option {
    name: string;
    department?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    allowCustomValue?: boolean;
}

const FEATURED_CITIES = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
    'Bucaramanga', 'Pereira', 'Santa Marta', 'Manizales', 'Villavicencio',
];

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Buscar...",
    label,
    className,
    allowCustomValue = true,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const normalizedSearch = search.trim().toLowerCase();

    const sortedOptions = [...options].sort((a, b) => {
        const aFeatured = FEATURED_CITIES.includes(a.name) ? 0 : 1;
        const bFeatured = FEATURED_CITIES.includes(b.name) ? 0 : 1;
        if (aFeatured !== bFeatured) return aFeatured - bFeatured;
        return a.name.localeCompare(b.name, 'es');
    });

    const filteredOptions = sortedOptions.filter(opt =>
        opt.name.toLowerCase().includes(search.toLowerCase()) ||
        (opt.department && opt.department.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 100);

    const exactMatchExists = options.some(
        (opt) => opt.name.trim().toLowerCase() === normalizedSearch
    );

    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = Math.min(360, spaceBelow > 200 ? spaceBelow - 16 : 300);

        if (spaceBelow > 200) {
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
                maxHeight: dropdownHeight,
                zIndex: 9999,
            });
        } else {
            setDropdownStyle({
                position: 'fixed',
                bottom: window.innerHeight - rect.top + 6,
                left: rect.left,
                width: rect.width,
                maxHeight: 280,
                zIndex: 9999,
            });
        }
    }, []);

    const handleOpen = () => {
        updatePosition();
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current && !containerRef.current.contains(target)) {
                // Check if clicking inside the portal dropdown
                const portal = document.getElementById('searchable-select-portal');
                if (portal && portal.contains(target)) return;
                setIsOpen(false);
            }
        };
        const handleScroll = () => { updatePosition(); };
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [isOpen, updatePosition]);

    const dropdown = isOpen && (
        <div
            id="searchable-select-portal"
            style={dropdownStyle}
            className="bg-white border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
            <div className="p-3 border-b border-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        autoFocus
                        type="text"
                        className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-foreground outline-none focus:border-primary focus:bg-white transition-all"
                        placeholder="Escribe el nombre de la ciudad..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <X
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground"
                            onClick={() => setSearch("")}
                        />
                    )}
                </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: (dropdownStyle.maxHeight as number ?? 300) - 56 }}>
                {allowCustomValue && normalizedSearch && !exactMatchExists && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange(search.trim());
                            setIsOpen(false);
                            setSearch("");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-border bg-primary/5 text-primary hover:bg-primary/10 transition-all"
                    >
                        <div>
                            <p className="text-sm font-bold">Usar "{search.trim()}"</p>
                            <p className="text-[9px] uppercase tracking-widest opacity-70 font-black">Ciudad personalizada</p>
                        </div>
                        <Check className="w-4 h-4" />
                    </button>
                )}
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((opt, i) => (
                        <div
                            key={`${opt.name}-${i}`}
                            onClick={() => {
                                onChange(opt.name);
                                setIsOpen(false);
                                setSearch("");
                            }}
                            className={clsx(
                                "flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:bg-muted",
                                value === opt.name ? "bg-primary/10 text-primary" : "text-foreground"
                            )}
                        >
                            <div>
                                <p className="text-sm font-semibold">{opt.name}</p>
                                {opt.department && <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{opt.department}</p>}
                            </div>
                            {value === opt.name && <Check className="w-4 h-4 text-primary" />}
                        </div>
                    ))
                ) : (
                    <div className="p-10 text-center">
                        <p className="text-xs text-muted-foreground font-bold">No se encontraron resultados</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={clsx("relative w-full", className)} ref={containerRef}>
            {label && (
                <p className="text-[10px] font-black text-primary uppercase ml-1 mb-1.5 tracking-widest">{label}</p>
            )}

            <div
                onClick={handleOpen}
                className={clsx(
                    "w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all",
                    isOpen && "border-primary ring-1 ring-primary/30 bg-white",
                    value ? "text-foreground" : "text-muted-foreground"
                )}
            >
                <span>{value || placeholder}</span>
                <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
            </div>

            {mounted && createPortal(dropdown, document.body)}
        </div>
    );
}
