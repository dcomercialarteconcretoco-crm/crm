"use client";

import React, { useState, useRef, useEffect } from 'react';
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
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Buscar...",
    label,
    className
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(search.toLowerCase()) ||
        (opt.department && opt.department.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 100); // Limit results for performance

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={clsx("relative w-full", className)} ref={containerRef}>
            {label && <p className="text-[10px] font-black text-primary uppercase ml-2 mb-2 tracking-widest">{label}</p>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold flex items-center justify-between cursor-pointer hover:border-white/20 transition-all",
                    isOpen && "border-primary/50 ring-1 ring-primary/50"
                )}
            >
                <span className={clsx(!value && "text-white/40")}>
                    {value || placeholder}
                </span>
                <ChevronDown className={clsx("w-4 h-4 text-white/40 transition-transform", isOpen && "rotate-180")} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0e] border border-white/10 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:border-primary/50 transition-all"
                                placeholder="Escribe el nombre de la ciudad..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <X
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 cursor-pointer hover:text-white"
                                    onClick={() => setSearch("")}
                                />
                            )}
                        </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <div key={`${opt.name}-${i}`}
                                    onClick={() => {
                                        onChange(opt.name);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={clsx(
                                        "flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all hover:bg-white/5",
                                        value === opt.name ? "bg-primary/10 text-primary" : "text-white/70"
                                    )}
                                >
                                    <div>
                                        <p className="text-sm font-bold">{opt.name}</p>
                                        {opt.department && <p className="text-[9px] uppercase tracking-widest opacity-40 font-black">{opt.department}</p>}
                                    </div>
                                    {value === opt.name && <Check className="w-4 h-4" />}
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center">
                                <p className="text-xs text-white/20 font-bold">No se encontraron resultados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
