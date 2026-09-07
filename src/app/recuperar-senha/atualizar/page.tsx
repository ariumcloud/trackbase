import Link from "next/link";
import { NewPasswordForm } from "@/components/forms";

export default function UpdatePasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-form">
        <div className="auth-box">
          <span className="tag">ACESSO SEGURO</span>
          <h1>Crie uma nova senha.</h1>
          <p>Escolha uma senha com pelo menos 10 caracteres.</p>
          <NewPasswordForm />
          <Link className="text-button" href="/login">Voltar para o login</Link>
        </div>
      </section>
    </main>
  );
}
