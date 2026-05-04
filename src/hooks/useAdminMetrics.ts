import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAdminView,
  type AdminViewSlug,
  type FetchAdminViewParams,
  type AlertaRow,
} from "@/lib/adminMetrics";
import { MOCK_ADMIN } from "@/lib/mockAdminMetrics";

export interface UseAdminViewOptions {
  previewMode?: boolean;
  staleTime?: number;
  enabled?: boolean;
}

const STALE_DEFAULT = 5 * 60 * 1000;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-metrics`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Em vitrine: chamamos via fetch direto pra evitar que supabase-js dispare
// o overlay de runtime do Lovable em respostas 401/403 esperadas.
// Qualquer falha (auth, rede, parse) cai silenciosamente no mock.
async function fetchPreviewView<T>(
  view: AdminViewSlug,
  params?: FetchAdminViewParams,
): Promise<T[]> {
  const fallback = (MOCK_ADMIN[view] as T[]) ?? [];
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? PUBLISHABLE_KEY;
    const body: Record<string, unknown> = { view };
    if (params?.pais) body.pais = params.pais;
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.info("[vitrine] Fallback mock ativado para view:", view);
      return fallback;
    }
    const json = await res.json().catch(() => null);
    const rows = json?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      console.info("[vitrine] Fallback mock ativado para view:", view);
      return fallback;
    }
    return rows as T[];
  } catch {
    console.info("[vitrine] Fallback mock ativado para view:", view);
    return fallback;
  }
}

export function useAdminView<T>(
  view: AdminViewSlug,
  params?: FetchAdminViewParams,
  opts?: UseAdminViewOptions,
) {
  const { previewMode = false, staleTime = STALE_DEFAULT, enabled = true } = opts ?? {};

  return useQuery<T[]>({
    queryKey: ["admin-metrics", view, params?.pais ?? null, previewMode],
    enabled,
    staleTime,
    retry: previewMode ? false : 1,
    queryFn: async () => {
      if (previewMode) return fetchPreviewView<T>(view, params);
      return fetchAdminView<T>(view, params);
    },
  });
}

export function useAlertasOperacionais(opts?: UseAdminViewOptions) {
  return useAdminView<AlertaRow>("alertas_operacionais", undefined, {
    staleTime: 60 * 1000,
    ...opts,
  });
}
