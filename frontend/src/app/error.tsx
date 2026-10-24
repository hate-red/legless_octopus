"use client";
import { Button } from "@/shared/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>Не удалось открыть страницу</h2>
      <p className="muted">Попробуйте загрузить её ещё раз.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
