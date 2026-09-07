import Link from "next/link";
import { PasswordResetForm } from "@/components/forms";

export default function RecoverPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-form">
        <div className="auth-box">
          <span className="tag">ACESSO SEGURO</span>
          <h1>Recupere sua senha.</h1>
          <p>Enviaremos um link para o e-mail da sua conta.</p>
          <PasswordResetForm />
          <Link className="text-button" href="/login">Voltar para o login</Link>
        </div>
      </section>
    </main>
  );
}
