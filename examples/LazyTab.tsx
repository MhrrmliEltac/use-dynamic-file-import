import { useState } from "react";
import { preloadModule, useDynamicFileImport } from "../src";

const loadStageTwo = () => import("./calculations");

export function LazyTab() {
  const [open, setOpen] = useState(false);

  // Tab açılana qədər null ötürülür, ona görə heç nə yüklənmir.
  const { mod, isLoading } = useDynamicFileImport(open ? loadStageTwo : null);

  return (
    <div>
      <button
        // Prefetch: istifadəçi düyməyə yaxınlaşanda yükləməyə başla.
        onMouseEnter={() => void preloadModule(loadStageTwo)}
        onFocus={() => void preloadModule(loadStageTwo)}
        onClick={() => setOpen(true)}
      >
        2-ci mərhələni aç
      </button>

      {open && (isLoading ? <p>Yüklənir…</p> : mod && <p>{mod.calculateTotal(10, 3)}</p>)}
    </div>
  );
}
