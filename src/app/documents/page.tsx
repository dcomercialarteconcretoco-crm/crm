'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Upload, Trash2, Eye, Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface DocumentRecord {
  id: string;
  name: string;
  filename: string;
  mimetype: string;
  size: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function DocumentsPage() {
  const { currentUser } = useApp();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Error al cargar documentos');
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('No se pudieron cargar los documentos. Verifica la conexión a la base de datos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', currentUser?.name || 'Desconocido');

      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al subir');
      showToast(`"${json.name}" subido correctamente`);
      await fetchDocuments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir documento';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc: DocumentRecord) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (!res.ok) throw new Error('No se pudo obtener el documento');
      const json = await res.json();
      const dataUrl = `data:${json.mimetype};base64,${json.data}`;
      window.open(dataUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('No se pudo previsualizar el documento.');
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    if (!confirm(`¿Eliminar "${doc.name}"?`)) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showToast(`"${doc.name}" eliminado`);
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar el documento.');
    }
  };

  const filtered = documents.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#fab510] text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Documentos Esenciales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centraliza RUT, Cámara de Comercio, certificaciones y más
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#fab510] hover:bg-[#e0a40e] text-white font-black rounded-2xl text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 shrink-0"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Subiendo...' : 'Subir Documento'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar documentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#fab510]/40 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-3">
            <span className="w-5 h-5 border-2 border-[#fab510]/30 border-t-[#fab510] rounded-full animate-spin" />
            Cargando documentos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <FileText className="w-12 h-12 text-[#fab510]/40" />
            <p className="font-black text-foreground text-base">
              {search ? 'Sin resultados' : 'Ningún documento subido aún'}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search
                ? 'Intenta con otro término de búsqueda.'
                : 'Sube documentos frecuentes como RUT, Cámara de Comercio, certificaciones y contratos para tenerlos siempre a mano.'}
            </p>
            {!search && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#fab510] hover:bg-[#e0a40e] text-white font-black rounded-2xl text-sm transition-all shadow-md"
              >
                <Upload className="w-4 h-4" />
                Subir primer documento
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                    Tamaño
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest hidden lg:table-cell">
                    Subido por
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    className={`border-b border-border/50 transition-colors hover:bg-[#fab510]/5 ${
                      idx === filtered.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#fab510]/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#fab510]" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-[260px]">
                            {doc.filename}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden sm:table-cell">
                      {formatSize(doc.size)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden md:table-cell">
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground hidden lg:table-cell">
                      {doc.uploaded_by || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handlePreview(doc)}
                          title="Vista previa"
                          className="p-2 rounded-xl hover:bg-[#fab510]/10 text-[#fab510] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          title="Eliminar"
                          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
          {search ? ' encontrado' : ''}
          {filtered.length !== 1 && search ? 's' : ''}
        </p>
      )}
    </div>
  );
}
