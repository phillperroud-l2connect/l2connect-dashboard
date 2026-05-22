export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatCurrencyARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = value.includes("T") ? value.slice(0, 10) : value;
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 10) : value;
}
