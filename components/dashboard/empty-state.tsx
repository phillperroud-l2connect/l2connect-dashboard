export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
