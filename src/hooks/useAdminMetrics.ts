import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  AdminMetricsAuthError,
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

export function useAdminView<T>(
  view: AdminViewSlug,
  params?: FetchAdminViewParams,
  opts?: UseAdminViewOptions,
) {
  const { previewMode = false, staleTime = STALE_DEFAULT, enabled = true } = opts ?? {};

  const key = ["admin-metrics", view, params?.pais ?? null, previewMode];

  return useQuery<T[]>({
    queryKey: key,
    enabled,
    staleTime,
    retry: (failureCount, err) => {
      // Em vitrine, não tenta de novo se foi 401/403 — devolve mock.
      if (previewMode && err instanceof AdminMetricsAuthError) return false;
      return failureCount < 1;
    },
    queryFn: async () => {
      try {
        return await fetchAdminView<T>(view, params);
      } catch (err) {
        if (previewMode) {
          // Vitrine: em qualquer falha (incluindo auth), devolve mock.
          return (MOCK_ADMIN[view] as T[]) ?? [];
        }
        throw err;
      }
    },
  });
}

export function useAlertasOperacionais(opts?: UseAdminViewOptions) {
  return useAdminView<AlertaRow>("alertas_operacionais", undefined, {
    staleTime: 60 * 1000,
    ...opts,
  });
}
