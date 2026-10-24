import Link from "next/link";
export default function NotFound() {
  return (
    <main className="boot">
      <h1>Страница не найдена</h1>
      <p className="muted">Проверьте адрес или вернитесь в кабинет.</p>
      <Link className="btn btn-primary" href="/dashboard">
        На главную
      </Link>
    </main>
  );
}
