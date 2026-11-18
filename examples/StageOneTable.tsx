import { useDynamicFileImport } from "../src";

// ✅ Import funksiyası komponentdən KƏNARDA: referans sabit qalır.
// "./calculations" ayrıca chunk-a çıxarılır və yalnız lazım olanda yüklənir.
const loadCalculations = () => import("./calculations");

type Row = { id: string; price: number; quantity: number };

export function StageOneTable({ rows }: { rows: Row[] }) {
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
            <td>{row.id}</td>
            <td>{mod.calculateTotal(row.price, row.quantity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
