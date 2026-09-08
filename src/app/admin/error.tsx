"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-card admin-empty" role="alert">
      <h2>Não foi possível carregar os dados</h2>
      <p>A conexão pode ter sido interrompida. Tente novamente.</p>
      <button className="button" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
