import { AuthForm } from "@/components/forms";
import { configured } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";

export default function Login() {
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand">
          <Image
            src="/logo.png"
            alt="Kirofy Logo"
            width={38}
            height={38}
            className="brand-logo-img"
          />
          Kirofy
          <span className="brand-dot" />
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
            Da primeira visita até o dinheiro na conta. Sua operação inteira
            reunida com números reais e sem taxas abusivas.
          </p>
        </div>
        <small>A plataforma pra você deixar de ser liso.</small>
      </section>
      <section className="auth-form">
        <AuthForm configured={configured()} />
      </section>
    </div>
  );
}
