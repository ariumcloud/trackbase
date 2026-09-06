import { AuthForm } from "@/components/forms";
import { configured } from "@/lib/supabase/server";
import Link from "next/link";
export default function Login() {
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-icon">u↗</span> UTM<span>Liso</span>
        </Link>
        <div>
          <span className="eyebrow">MENOS ACHISMO. MAIS RESULTADO.</span>
          <h1>
            Cada clique
            <br />
            tem uma história.
            <br />
            <em>Descubra qual vende.</em>
          </h1>
          <p>
            Da primeira visita à compra. Sua operação inteira, com os números
            que realmente importam.
          </p>
        </div>
        <small>O rastreamento profissional para quem ainda está liso.</small>
      </section>
      <section className="auth-form">
        <AuthForm configured={configured()} />
      </section>
    </div>
  );
}
