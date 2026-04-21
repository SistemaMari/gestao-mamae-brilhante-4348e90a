import { useEffect, useState } from 'react';
import { countries } from '@/data/locationData';

// Cache em memória por sessão: UF -> lista de cidades
const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

function fallbackCidades(pais: string, uf: string): string[] {
  const country = countries.find((c) => c.value === pais);
  const state = country?.states.find((s) => s.value === uf);
  return state?.cities || [];
}

async function fetchMunicipiosIBGE(uf: string): Promise<string[]> {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  const data: Array<{ nome: string }> = await res.json();
  return data
    .map((m) => m.nome)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function useCidadesIBGE(pais: string, uf: string) {
  const [cidades, setCidades] = useState<string[]>(() =>
    pais === 'Brasil' && uf && cache.has(uf) ? cache.get(uf)! : fallbackCidades(pais, uf)
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!uf) {
      setCidades([]);
      setErro(null);
      return;
    }

    // Países diferentes de Brasil: usa fallback estático
    if (pais !== 'Brasil') {
      setCidades(fallbackCidades(pais, uf));
      setErro(null);
      return;
    }

    // Brasil: tenta API IBGE com cache
    if (cache.has(uf)) {
      setCidades(cache.get(uf)!);
      setErro(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErro(null);

    const promise =
      inflight.get(uf) ??
      (() => {
        const p = fetchMunicipiosIBGE(uf);
        inflight.set(uf, p);
        return p;
      })();

    promise
      .then((lista) => {
        cache.set(uf, lista);
        inflight.delete(uf);
        if (!cancelled) {
          setCidades(lista);
          setLoading(false);
        }
      })
      .catch((err) => {
        inflight.delete(uf);
        if (!cancelled) {
          console.warn('Falha ao buscar municípios do IBGE, usando fallback:', err);
          setCidades(fallbackCidades(pais, uf));
          setErro('offline');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pais, uf]);

  return { cidades, loading, erro };
}
