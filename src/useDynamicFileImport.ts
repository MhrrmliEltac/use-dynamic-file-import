import { useCallback, useEffect, useState } from "react";

/** `() => import("./fayl")` formasında import funksiyası. */
export type Loader<T> = () => Promise<T>;

export type DynamicImportState<T> = {
  /** Yüklənmiş modul. Hələ yoxdursa `null`. */
  mod: T | null;
  /** Fayl hələ yüklənirsə `true`. */
  isLoading: boolean;
  /** Yükləmə uğursuz olarsa xəta. */
  error: Error | null;
};

export type DynamicImportResult<T> = DynamicImportState<T> & {
  /** Uğursuz yükləməni yenidən cəhd edir. */
  retry: () => void;
};

// Hazır modullar: render zamanı sinxron oxumaq üçün (loader yanıb-sönməsin).
const valueCache = new Map<Loader<unknown>, unknown>();
// Yolda olan yükləmələr: eyni anda gələn çağırışları bir yükləməyə birləşdirir.
const promiseCache = new Map<Loader<unknown>, Promise<unknown>>();

/**
 * Modulu yükləyir və keşləyir. Hook-dan kənarda da çağırıla bilər,
 * məsələn hover zamanı əvvəlcədən yükləmək (prefetch) üçün.
 */
export function preloadModule<T>(fn: Loader<T>): Promise<T> {
  if (valueCache.has(fn)) return Promise.resolve(valueCache.get(fn) as T);

  let p = promiseCache.get(fn) as Promise<T> | undefined;
  if (!p) {
    p = fn().then(
      (mod) => {
        valueCache.set(fn, mod);
        promiseCache.delete(fn);
        return mod;
      },
      (err: unknown) => {
        // Xətadan sonra keşdən silirik ki, retry həqiqətən yenidən cəhd etsin.
        promiseCache.delete(fn);
        throw err;
      }
    );
    promiseCache.set(fn, p);
  }
  return p;
}

/** Keşi təmizləyir. Əsasən testlər üçündür. */
export function clearModuleCache(): void {
  valueCache.clear();
  promiseCache.clear();
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function initialState<T>(fn: Loader<T> | null): DynamicImportState<T> {
  if (fn && valueCache.has(fn)) {
    return { mod: valueCache.get(fn) as T, isLoading: false, error: null };
  }
  return { mod: null, isLoading: fn !== null, error: null };
}

/**
 * Böyük faylı (kitabxana, data, hesablama modulu) yalnız lazım olanda yükləyir.
 *
 * `importFn` sabit referans olmalıdır: onu komponentdən kənarda təyin edin
 * və ya `useCallback` ilə əhatə edin. `null` ötürsəniz heç nə yüklənmir.
 *
 * @example
 * const loadCalculations = () => import("./calculations");
 * const { mod, isLoading, error, retry } = useDynamicFileImport(loadCalculations);
 */
export function useDynamicFileImport<T>(
  importFn: Loader<T> | null
): DynamicImportResult<T> {
  const [state, setState] = useState<DynamicImportState<T>>(() =>
    initialState(importFn)
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!importFn) {
      setState((s) =>
        s.mod === null && !s.isLoading && s.error === null
          ? s
          : { mod: null, isLoading: false, error: null }
      );
      return;
    }

    if (valueCache.has(importFn)) {
      const cached = valueCache.get(importFn) as T;
      setState((s) =>
        s.mod === cached && !s.isLoading && s.error === null
          ? s
          : { mod: cached, isLoading: false, error: null }
      );
      return;
    }

    let cancelled = false;
    setState({ mod: null, isLoading: true, error: null });

    preloadModule(importFn).then(
      (mod) => {
        if (!cancelled) setState({ mod, isLoading: false, error: null });
      },
      (err: unknown) => {
        if (cancelled) return;
        console.error("Dynamic import failed:", err);
        setState({ mod: null, isLoading: false, error: toError(err) });
      }
    );

    // Köhnə yükləmənin nəticəsi yenisinin üstünə yazılmasın (race condition).
    return () => {
      cancelled = true;
    };
  }, [importFn, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { ...state, retry };
}

export default useDynamicFileImport;
