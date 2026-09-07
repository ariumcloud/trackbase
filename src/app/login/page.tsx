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
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt="Trackbase Logo"
            width={38}
            height={38}
            className="brand-logo-img"
          />
          Trackbase
          <span className="brand-dot" />
        </Link>
        <div>
          <span className="eyebrow">RASTREAMENTO É A BASE DA TUA ESCALA.</span>
          <h1>
            Escala com clareza.
            <br />
            <em>Venda com controle.</em>
          </h1>
          <p>
            Da primeira visita até o dinheiro na conta. Sua operação inteira
            reunida com números reais e sem taxas abusivas.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <AuthForm configured={configured()} />
      </section>
    </div>
  );
}
