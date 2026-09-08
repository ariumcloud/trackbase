import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { redirect, notFound } from "next/navigation";
import { configured } from "@/lib/supabase/server";
import { getAuthUser, checkPlatformAdmin } from "@/lib/platform-admin";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin · Trackbase",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/login");
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!(await checkPlatformAdmin(user.id))) notFound();
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link href="/admin" className="brand">
          <Image
            src="/Logo Roxa SVG - 1024x1024.svg"
            alt=""
            width={30}
            height={30}
          />
          Trackbase{" "}
          <span className="admin-label">
            <ShieldCheck size={13} /> Admin
          </span>
        </Link>
        <div className="admin-account">
          <span>{user.email}</span>
          <Link href="/painel" className="button ghost small">
            <ArrowLeft size={15} /> Meu painel
          </Link>
        </div>
      </header>
      <main className="admin-main">{children}</main>
      <footer className="admin-footer">
        <ShieldCheck size={14} /> Acesso restrito · Alterações administrativas
        ficam registradas no histórico.
      </footer>
    </div>
  );
}
