export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground"
      style={{ borderColor: "rgba(255,255,255,0.1)" }}
    >
      {message}
    </div>
  );
}
