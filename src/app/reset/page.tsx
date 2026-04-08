"use client";

import { useState } from "react";

const PROTECTED_EMAIL = "juanchosierra@gmail.com";

const LOCAL_STORAGE_KEYS = [
  "crm_clients",
  "crm_tasks",
  "crm_quotes",
  "crm_sellers",
  "crm_notifications",
  "crm_audit_logs_v_final",
  "crm_anomalies_v_final",
  "crm_events",
  "crm_inventory_products",
  "crm_forms",
  "crm_product_sync_status",
];

export default function ResetPage() {
  const [status, setStatus] = useState<"idle" | "confirming" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  const handleReset = async () => {
    if (status === "idle") {
      setStatus("confirming");
      return;
    }

    setStatus("running");

    try {
      // 1. Call the server API to clear Postgres
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();

      // 2. Clear localStorage keys (except current_user which we'll handle)
      for (const key of LOCAL_STORAGE_KEYS) {
        if (key === "crm_sellers") {
          // Keep only the superadmin seller
          const saved = localStorage.getItem(key);
          if (saved) {
            try {
              const sellers = JSON.parse(saved);
              const preserved = sellers.filter(
                (s: { email?: string }) =>
                  s.email?.toLowerCase() === PROTECTED_EMAIL.toLowerCase()
              );
              localStorage.setItem(key, JSON.stringify(preserved));
            } catch {
              localStorage.setItem(key, "[]");
            }
          }
        } else {
          localStorage.setItem(key, "[]");
        }
      }

      // Reset product sync status
      localStorage.setItem(
        "crm_product_sync_status",
        JSON.stringify({ lastResult: "idle", syncedCount: 0 })
      );

      setStatus("done");
      setResult(
        `Limpieza completada.\n\nServidor: ${data.persistence === "postgres" ? "PostgreSQL limpiado" : "Solo localStorage"}\nUsuario preservado: ${data.preservedUser?.name || "superadmin"} (${PROTECTED_EMAIL})\n\nRecarga la pagina para ver los cambios.`
      );
    } catch (err) {
      setStatus("error");
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <h1 className="text-2xl font-bold mb-2">Reset CRM Data</h1>
        <p className="text-gray-400 mb-6">
          Esto eliminara TODOS los datos de prueba: clientes, cotizaciones, tareas,
          leads, notificaciones, eventos, formularios y usuarios.
        </p>

        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
          <p className="text-green-400 font-semibold">Usuario protegido:</p>
          <p className="text-green-300">{PROTECTED_EMAIL} (SuperAdmin) — NO se borrara</p>
        </div>

        {status === "confirming" && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400 font-bold">
              CONFIRMAR: Se borraran TODOS los datos excepto tu cuenta superadmin.
              Esta accion NO se puede deshacer.
            </p>
          </div>
        )}

        {(status === "done" || status === "error") && (
          <pre className={`rounded-lg p-4 mb-6 text-sm whitespace-pre-wrap ${status === "done" ? "bg-green-900/20 text-green-300" : "bg-red-900/20 text-red-300"}`}>
            {result}
          </pre>
        )}

        <div className="flex gap-4">
          {status !== "done" && (
            <button
              onClick={handleReset}
              disabled={status === "running"}
              className={`px-6 py-3 rounded-lg font-bold text-white ${
                status === "confirming"
                  ? "bg-red-600 hover:bg-red-700"
                  : status === "running"
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-yellow-600 hover:bg-yellow-700"
              }`}
            >
              {status === "idle" && "Borrar datos de prueba"}
              {status === "confirming" && "SI, BORRAR TODO"}
              {status === "running" && "Limpiando..."}
            </button>
          )}

          {status === "done" && (
            <button
              onClick={() => window.location.href = "/"}
              className="px-6 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700"
            >
              Ir al CRM
            </button>
          )}

          {status === "confirming" && (
            <button
              onClick={() => setStatus("idle")}
              className="px-6 py-3 rounded-lg font-bold text-gray-300 bg-gray-700 hover:bg-gray-600"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
