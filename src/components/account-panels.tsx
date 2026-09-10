"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
  Loader2,
} from "lucide-react";
import { plans, canUse, normalizePlan } from "@/lib/plans";
import {
  updateAccountPassword,
  mfaListFactors,
  mfaEnroll,
  mfaVerify,
  mfaUnenroll,
  inviteMember,
  removeMember,
  listMembersWithEmail,
} from "@/app/actions";

const STRIPE_UPGRADE_URL = "https://buy.stripe.com/aFa5kF3Wu8AZaQZ0S79IQ03";

type AccountView = "assinatura" | "conta" | "avancado";

type Account = { name: string | null; document: string | null; email: string | null };

type UsageMetric = { label: string; used: number; limit: number };

export function AccountPanels({
  view,
  onBack,
  onOpenMcp,
  workspace,
  workspaceName,
  plan,
  account,
  usage,
}: {
  view: AccountView;
  onBack: () => void;
  onOpenMcp: () => void;
  workspace: string;
  workspaceName: string;
  plan: string;
  account: Account;
  usage: UsageMetric[];
}) {
  return (
    <div className="account-panel">
      <button type="button" className="account-panel-back" onClick={onBack}>
        <ArrowLeft size={15} /> Voltar
      </button>
      {view === "assinatura" && <AssinaturaPanel plan={plan} usage={usage} />}
      {view === "conta" && <MinhaContaPanel account={account} plan={plan} />}
      {view === "avancado" && (
        <AvancadoPanel workspace={workspace} workspaceName={workspaceName} plan={plan} onOpenMcp={onOpenMcp} />
      )}
    </div>
  );
}

function AssinaturaPanel({ plan, usage }: { plan: string; usage: UsageMetric[] }) {
  const planId = normalizePlan(plan);
  const info = plans[planId];
  return (
    <section className="account-section">
      <h2>Assinatura</h2>
      <p className="account-section-subtitle">Seu plano atual, limites de uso e faturas.</p>

      <div className="account-plan-card">
        <div>
          <span className="account-plan-name">{info.name}</span>
          <span className="account-plan-price">
            {info.price === 0 ? "Grátis" : `R$ ${info.price.toFixed(2).replace(".", ",")}/mês`}
          </span>
        </div>
        <a href={STRIPE_UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="button primary">
          Fazer upgrade <ArrowUpRight size={15} />
        </a>
      </div>

      <h3 className="account-subheading">Uso do plano</h3>
      <div className="account-usage-grid">
        {usage.map((u) => {
          const pct = u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
          const atLimit = u.limit > 0 && u.used >= u.limit;
          return (
            <div className="account-usage-card" key={u.label}>
              <div className="account-usage-head">
                <span>{u.label}</span>
                <strong className={atLimit ? "account-usage-alert" : ""}>
                  {u.used} / {u.limit}
                </strong>
              </div>
              <div className="account-usage-bar">
                <div
                  className={`account-usage-bar-fill${atLimit ? " account-usage-bar-fill-alert" : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="account-subheading">Histórico de faturas</h3>
      <div className="account-empty-state">
        Nenhuma fatura registrada ainda. As faturas aparecem aqui após a confirmação do pagamento.
      </div>
    </section>
  );
}

function MinhaContaPanel({ account, plan }: { account: Account; plan: string }) {
  return (
    <section className="account-section">
      <h2>Minha conta</h2>
      <p className="account-section-subtitle">Seus dados de cadastro e segurança da conta.</p>

      <div className="account-info-grid">
        <div className="account-info-item">
          <span>Nome</span>
          <strong>{account.name || "—"}</strong>
        </div>
        <div className="account-info-item">
          <span>CPF/CNPJ</span>
          <strong>{account.document || "—"}</strong>
        </div>
        <div className="account-info-item">
          <span>E-mail</span>
          <strong>{account.email || "—"}</strong>
        </div>
        <div className="account-info-item">
          <span>Plano</span>
          <strong>{plans[normalizePlan(plan)].name}</strong>
        </div>
      </div>

      <h3 className="account-subheading">Idioma</h3>
      <div className="account-info-grid">
        <div className="account-info-item">
          <span>Idioma da interface</span>
          <input className="account-disabled-input" value="Português (BR)" disabled readOnly />
        </div>
      </div>

      <h3 className="account-subheading">Trocar senha</h3>
      <PasswordForm />

      <h3 className="account-subheading">Autenticação de dois fatores (2FA)</h3>
      <MfaPanel />
    </section>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  value,
  onChange,
}: {
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="account-field">
      <span>{label}</span>
      <div className="account-password-input">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="account-password-toggle"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="account-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        if (newPassword !== confirmPassword) {
          setMessage({ type: "error", text: "A confirmação não confere com a nova senha." });
          return;
        }
        const data = new FormData();
        data.set("currentPassword", currentPassword);
        data.set("newPassword", newPassword);
        start(async () => {
          const result = await updateAccountPassword(data);
          if (result.error) {
            setMessage({ type: "error", text: result.error });
          } else {
            setMessage({ type: "ok", text: "Senha atualizada com sucesso." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
          }
        });
      }}
    >
      <PasswordField
        name="currentPassword"
        label="Senha atual"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
      />
      <PasswordField
        name="newPassword"
        label="Nova senha"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirmar nova senha"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />
      <p className="form-help">
        A senha precisa ter pelo menos 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "Aguarde…" : "Atualizar senha"}
      </button>
      {message && (
        <p className={`form-message ${message.type === "error" ? "form-message-error" : ""}`} role="status">
          {message.text}
        </p>
      )}
    </form>
  );
}

function MfaPanel() {
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let mounted = true;
    mfaListFactors().then((res) => {
      if (!mounted) return;
      setLoading(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setEnrolled(Boolean(res.enrolled));
      setFactorId(res.factorId || null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="account-mfa-loading">
        <Loader2 size={15} className="spin" /> Carregando status do 2FA…
      </div>
    );
  }

  if (enrolled) {
    return (
      <div className="account-mfa">
        <div className="account-mfa-status account-mfa-status-on">
          <ShieldCheck size={16} /> 2FA ativado nesta conta
        </div>
        <button
          type="button"
          className="button ghost small"
          disabled={pending}
          onClick={() => {
            if (!factorId) return;
            start(async () => {
              const result = await mfaUnenroll(factorId);
              if (result.error) {
                setMessage({ type: "error", text: result.error });
              } else {
                setEnrolled(false);
                setFactorId(null);
                setMessage({ type: "ok", text: "2FA desativado." });
              }
            });
          }}
        >
          <ShieldOff size={14} /> Desativar 2FA
        </button>
        {message && (
          <p className={`form-message ${message.type === "error" ? "form-message-error" : ""}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="account-mfa">
        <div className="account-mfa-status">
          <ShieldOff size={16} /> 2FA não ativado
        </div>
        <button
          type="button"
          className="button primary"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await mfaEnroll();
              if (result.error) {
                setMessage({ type: "error", text: result.error });
                return;
              }
              setFactorId(result.factorId || null);
              setQrCode(result.qrCode || null);
              setSecret(result.secret || null);
            });
          }}
        >
          <ShieldCheck size={15} /> Ativar 2FA
        </button>
        {message && (
          <p className={`form-message ${message.type === "error" ? "form-message-error" : ""}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="account-mfa">
      <p className="form-help">
        Escaneie o QR code com seu aplicativo autenticador (Google Authenticator, Authy, 1Password) ou digite a
        chave manualmente.
      </p>
      <div className="account-mfa-qr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCode} alt="QR code para configurar 2FA" width={160} height={160} />
        {secret && <code className="account-mfa-secret">{secret}</code>}
      </div>
      <form
        className="account-form account-mfa-verify"
        onSubmit={(e) => {
          e.preventDefault();
          if (!factorId) return;
          setMessage(null);
          start(async () => {
            const result = await mfaVerify(factorId, code);
            if (result.error) {
              setMessage({ type: "error", text: result.error });
            } else {
              setEnrolled(true);
              setQrCode(null);
              setSecret(null);
              setCode("");
              setMessage({ type: "ok", text: "2FA ativado com sucesso." });
            }
          });
        }}
      >
        <label className="account-field">
          <span>Código de 6 dígitos</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            minLength={6}
            required
            placeholder="000000"
          />
        </label>
        <button className="button primary" disabled={pending}>
          {pending ? "Verificando…" : "Confirmar"}
        </button>
        {message && (
          <p className={`form-message ${message.type === "error" ? "form-message-error" : ""}`} role="status">
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}

function AvancadoPanel({
  workspace,
  workspaceName,
  plan,
  onOpenMcp,
}: {
  workspace: string;
  workspaceName: string;
  plan: string;
  onOpenMcp: () => void;
}) {
  const hasAgency = canUse(plan, "agency");
  return (
    <section className="account-section">
      <h2>Avançado</h2>
      <p className="account-section-subtitle">Configurações avançadas do workspace {workspaceName}.</p>

      <h3 className="account-subheading">Colaboradores</h3>
      {!hasAgency ? (
        <div className="account-locked">
          <p>Disponível apenas no Plano Premium.</p>
          <a href={STRIPE_UPGRADE_URL} target="_blank" rel="noopener noreferrer" className="button primary">
            Fazer upgrade <ArrowUpRight size={15} />
          </a>
        </div>
      ) : (
        <MembersManager workspace={workspace} />
      )}

      <h3 className="account-subheading">Integração MCP</h3>
      <button type="button" className="text-button" onClick={onOpenMcp}>
        Abrir integração MCP →
      </button>
    </section>
  );
}

function MembersManager({ workspace }: { workspace: string }) {
  const [members, setMembers] = useState<Array<{ userId: string; email: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const reload = () => {
    setLoading(true);
    listMembersWithEmail(workspace).then((res) => {
      setLoading(false);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setMembers(res.members || []);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  return (
    <div className="account-members">
      {loading ? (
        <div className="account-mfa-loading">
          <Loader2 size={15} className="spin" /> Carregando colaboradores…
        </div>
      ) : (
        <div className="account-members-list">
          {members.length === 0 ? (
            <p className="form-help">Nenhum colaborador cadastrado além de você.</p>
          ) : (
            members.map((m) => (
              <div className="account-member-row" key={m.userId}>
                <Users size={14} />
                <span className="account-member-email">{m.email}</span>
                <span className={`account-role-badge account-role-${m.role}`}>{m.role}</span>
                {m.role !== "owner" && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remover colaborador"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        const result = await removeMember(workspace, m.userId);
                        if (result.error) {
                          setMessage({ type: "error", text: result.error });
                        } else {
                          reload();
                        }
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <form
        className="account-form account-invite-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          setMessage(null);
          start(async () => {
            const result = await inviteMember(workspace, data);
            if (result.error) {
              setMessage({ type: "error", text: result.error });
            } else {
              form.reset();
              setMessage({ type: "ok", text: "Colaborador convidado com sucesso." });
              reload();
            }
          });
        }}
      >
        <label className="account-field">
          <span>Convidar por e-mail</span>
          <input name="email" type="email" placeholder="colaborador@empresa.com" required />
        </label>
        <button className="button primary" disabled={pending}>
          <UserPlus size={15} /> Convidar
        </button>
      </form>
      {message && (
        <p className={`form-message ${message.type === "error" ? "form-message-error" : ""}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
