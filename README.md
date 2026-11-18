# useDynamicFileImport

Böyük faylları (kitabxanalar, data dəstləri, hesablama modulları) **yalnız lazım olanda** yükləyən React hook-u. Ağır səhifənin ilkin JavaScript bundle-ını kiçiltmək üçündür.

- ⚡ **Code splitting:** `import()` ilə fayl ayrıca chunk-a çıxarılır və ilk yüklənmədə endirilmir
- 🗂️ **Keş:** modul bir dəfə yüklənir, sonrakı komponentlər onu loader olmadan dərhal alır
- 🔀 **Race condition-dan qorunma:** köhnə yükləmənin nəticəsi yenisinin üstünə yazılmır
- 🔁 **Retry:** uğursuz yükləməni yenidən cəhd etmək mümkündür
- 🚀 **Prefetch:** `preloadModule()` ilə yükləməni əvvəlcədən başlatmaq olar (məsələn, hover zamanı)
- 🧩 **TypeScript:** yüklənmiş modulun tipi tam saxlanılır

---

## Niyə?

Faylın əvvəlində yazılan adi import **statikdir**:

```ts
import { calculate } from "./heavy-calculations";
```

Bundler (Vite, webpack) bu faylı əsas bundle-a daxil edir. İstifadəçi həmin funksiyaya heç vaxt toxunmasa belə, kod səhifə açılanda yüklənir, parse olunur və icra olunur. Zəif telefonlarda bu proses saniyələr çəkir və səhifə bu müddət ərzində interaktiv olmur.

**Dynamic import** isə promise qaytaran funksiya çağırışıdır:

```ts
const mod = await import("./heavy-calculations");
```

Bundler bu faylı ayrıca chunk-a çıxarır və brauzer onu yalnız həmin sətir icra olunanda yükləyir. Bu hook həmin prosesi React komponentlərində rahat istifadə etmək üçün yüklənmə vəziyyəti, xəta, keş və retry ilə birlikdə təqdim edir.

---

## Quraşdırma

`src/useDynamicFileImport.ts` faylını layihənizə köçürün. Faylın xarici asılılığı yoxdur, yalnız `react` (18 və ya daha yeni) lazımdır.

---

## İstifadə

### Əsas nümunə

```tsx
import { useDynamicFileImport } from "./useDynamicFileImport";

// ✅ Import funksiyası komponentdən KƏNARDA təyin olunur
const loadCalculations = () => import("./calculations");

function StageOneTable({ rows }) {
  const { mod, isLoading, error, retry } = useDynamicFileImport(loadCalculations);

  if (isLoading) return <p>Yüklənir…</p>;

  if (error) {
    return (
      <div role="alert">
        <p>Hesablama modulu yüklənmədi.</p>
        <button onClick={retry}>Yenidən cəhd et</button>
      </div>
    );
  }

  if (!mod) return null;

  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{mod.calculateTotal(row.price, row.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Yükləməni gecikdirmək (`null`)

`null` ötürsəniz heç nə yüklənmir və `isLoading` `false` olur. Bu, faylı yalnız istifadəçi tab-ı açanda yükləmək üçün faydalıdır:

```tsx
const { mod } = useDynamicFileImport(isTabOpen ? loadStageTwo : null);
```

### Prefetch: yükləməni əvvəlcədən başlatmaq

Hook yükləməni komponent render olandan sonra başladır. İstifadəçinin növbəti addımını təxmin edə bilirsinizsə, `preloadModule()` ilə yükləməni daha tez başladın:

```tsx
import { preloadModule } from "./useDynamicFileImport";

<button
  onMouseEnter={() => preloadModule(loadStageTwo)}
  onFocus={() => preloadModule(loadStageTwo)}
  onClick={() => setTab(2)}
>
  2-ci mərhələ
</button>
```

İstifadəçi düyməyə basana qədər modul çox vaxt artıq hazır olur və loader ümumiyyətlə görünmür.

Daha çox nümunə [`examples/`](./examples) qovluğundadır.

---

## ⚠️ Vacib qayda: import funksiyasının referansı sabit olmalıdır

Keşin açarı funksiyanın **referansıdır**. Funksiyanı komponentin içində yazsanız, hər render-də yeni funksiya yaranır. Nəticədə keş heç vaxt uyğun gəlmir və yükləmə hər render-də yenidən başlayır.

```tsx
// ❌ Səhv: hər render-də yeni funksiya
function Table() {
  const { mod } = useDynamicFileImport(() => import("./calculations"));
}

// ✅ Düzgün: funksiya komponentdən kənarda
const loadCalculations = () => import("./calculations");

function Table() {
  const { mod } = useDynamicFileImport(loadCalculations);
}
```

Funksiya props-dan və ya state-dən asılıdırsa, onu `useCallback` ilə əhatə edin.

---

## API

### `useDynamicFileImport<T>(importFn)`

| Parametr   | Tip                          | Təsvir                                                     |
| ---------- | ---------------------------- | ---------------------------------------------------------- |
| `importFn` | `(() => Promise<T>) \| null` | `() => import("./fayl")` funksiyası. `null` olarsa heç nə yüklənmir. |

Qaytarır:

| Sahə        | Tip             | Təsvir                                       |
| ----------- | --------------- | -------------------------------------------- |
| `mod`       | `T \| null`     | Yüklənmiş modul. Hələ yoxdursa `null`.       |
| `isLoading` | `boolean`       | Fayl hələ yüklənirsə `true`.                 |
| `error`     | `Error \| null` | Yükləmə uğursuz olarsa xəta.                 |
| `retry`     | `() => void`    | Uğursuz yükləməni yenidən cəhd edir.         |

### `preloadModule<T>(importFn): Promise<T>`

Modulu hook-dan kənarda yükləyir və keşə yazır. Prefetch üçün istifadə olunur.

### `clearModuleCache(): void`

Keşi tam təmizləyir. Əsasən testlər üçündür.

---

## Necə işləyir

Hook iki keşdən istifadə edir:

- **`valueCache`** hazır modulları saxlayır. Modul keşdədirsə, hook onu **ilk render-də sinxron** qaytarır, ona görə loader bir kadr belə görünmür.
- **`promiseCache`** yolda olan yükləmələri saxlayır. İki komponent eyni faylı eyni anda istəsə, yalnız bir yükləmə gedir.

Yükləmə uğursuz olanda promise keşdən silinir, ona görə `retry()` həqiqətən yenidən cəhd edir.

`importFn` dəyişəndə əvvəlki yükləmə "ləğv olunmuş" kimi işarələnir. Onun nəticəsi gec gəlsə də, state-ə yazılmır.

---

## Məhdudiyyətlər və məsləhətlər

**Deploy-dan sonra chunk tapılmaya bilər.** Yeni versiya deploy olunanda köhnə chunk faylları (`calculations-a3f9.js`) serverdən silinə bilər, amma istifadəçinin brauzerində köhnə səhifə hələ açıqdır. Bu halda `retry()` kömək etmir, çünki fayl artıq mövcud deyil. Ən etibarlı həllər bunlardır:

- köhnə chunk-ları deploy-dan sonra bir müddət serverdə saxlamaq;
- belə xətada səhifəni yeniləmək. Vite-da bunun üçün `vite:preloadError` event-i var:
  ```ts
  window.addEventListener("vite:preloadError", () => window.location.reload());
  ```

**Dynamic import yükləməni həll edir, hesablamanı yox.** Modul yükləndikdən sonra ağır hesablama yenə main thread-də işləyir və UI-ni dondura bilər. Belə hallarda hesablamanı **Web Worker**-ə köçürün, cədvəli **virtualizasiya** edin və ya `useMemo` / `useTransition` istifadə edin.

**Komponentlər üçün `React.lazy` istifadə edin.** Bu hook fayllar və modullar üçündür. React komponentlərini bölmək üçün `React.lazy` + `Suspense` daha uyğundur.

**Əvvəl ölçün.** Hansı faylları bölmək lazım olduğunu tapmaq üçün bundle analyzer istifadə edin: `rollup-plugin-visualizer` (Vite), `webpack-bundle-analyzer` və ya `@next/bundle-analyzer`. Ən çox rast gəlinən namizədlər bunlardır: qrafik kitabxanaları, Excel/PDF generatorları, rich-text redaktorlar, tarix kitabxanalarının locale faylları və tam yüklənmiş `lodash`.

---

## İnkişaf

```bash
npm install
npm test           # testlər (Vitest + Testing Library)
npm run typecheck  # TypeScript yoxlaması
npm run build      # dist/ qovluğuna build
```

Testlər bu halları yoxlayır:

- modulun yüklənməsi və vəziyyətlərin ardıcıllığı;
- `null` ötürüləndə loader-in görünməməsi;
- keşdəki modulun ilk render-də sinxron qaytarılması;
- eyni anda gələn çağırışların bir yükləməyə birləşdirilməsi;
- race condition: köhnə nəticənin yenisinin üstünə yazılmaması;
- xəta və `retry()`.

---

## Lisenziya

[MIT](./LICENSE)
