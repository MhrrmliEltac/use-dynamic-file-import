import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearModuleCache,
  preloadModule,
  useDynamicFileImport,
  type Loader,
} from "../src";

type Mod = { value: number };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearModuleCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDynamicFileImport", () => {
  it("modulu yükləyir və vəziyyətləri düzgün göstərir", async () => {
    const loader: Loader<Mod> = () => Promise.resolve({ value: 1 });
    const { result } = renderHook(() => useDynamicFileImport(loader));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.mod).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mod).toEqual({ value: 1 });
    expect(result.current.error).toBeNull();
  });

  it("null ötürüləndə heç nə yükləmir və loader göstərmir", () => {
    const { result } = renderHook(() => useDynamicFileImport<Mod>(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mod).toBeNull();
  });

  it("keşdə olan modulu ilk render-də sinxron qaytarır", async () => {
    const loader: Loader<Mod> = () => Promise.resolve({ value: 2 });
    await preloadModule(loader);

    const { result } = renderHook(() => useDynamicFileImport(loader));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.mod).toEqual({ value: 2 });
  });

  it("eyni anda gələn çağırışları bir yükləməyə birləşdirir", async () => {
    const loader = vi.fn(() => Promise.resolve({ value: 3 }));
    const a = renderHook(() => useDynamicFileImport(loader));
    const b = renderHook(() => useDynamicFileImport(loader));

    await waitFor(() => {
      expect(a.result.current.mod).toEqual({ value: 3 });
      expect(b.result.current.mod).toEqual({ value: 3 });
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("köhnə yükləmənin nəticəsi yenisinin üstünə yazılmır", async () => {
    const slow = deferred<Mod>();
    const fast = deferred<Mod>();
    const loadA: Loader<Mod> = () => slow.promise;
    const loadB: Loader<Mod> = () => fast.promise;

    const { result, rerender } = renderHook(
      ({ fn }) => useDynamicFileImport(fn),
      { initialProps: { fn: loadA } }
    );

    rerender({ fn: loadB });
    await act(async () => fast.resolve({ value: 20 }));
    await act(async () => slow.resolve({ value: 10 }));

    expect(result.current.mod).toEqual({ value: 20 });
  });

  it("xətanı göstərir və retry ilə yenidən cəhd edir", async () => {
    const loader = vi
      .fn<() => Promise<Mod>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ value: 4 });

    const { result } = renderHook(() => useDynamicFileImport(loader));

    await waitFor(() => expect(result.current.error?.message).toBe("network"));
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.mod).toEqual({ value: 4 }));
    expect(result.current.error).toBeNull();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
