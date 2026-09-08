"use server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { adminMutationSchema } from "@/lib/admin-validation";
import { rateLimit } from "@/lib/security";

export async function adminMutation(
  form: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { user, client } = await requirePlatformAdmin();
    const parsed = adminMutationSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      return {
        error:
          "Confira os campos e descreva o motivo com pelo menos 3 caracteres.",
      };
    if (!(await rateLimit(`platform-admin:${user.id}`, 30)))
      return { error: "Muitas alterações. Aguarde um minuto." };
    const { action, target, ...input } = parsed.data;
    const { error } = await client.rpc("utm_admin_mutate", {
      p_actor: user.id,
      p_action: action,
      p_target: target,
      p_input: input,
    });
    if (error)
      return {
        error:
          "A alteração não foi salva. Atualize a página e tente novamente.",
      };
    revalidatePath("/admin", "layout");
    revalidatePath("/painel");
    return { ok: true };
  } catch {
    return {
      error:
        "Não foi possível concluir. Verifique seu acesso e tente novamente.",
    };
  }
}
