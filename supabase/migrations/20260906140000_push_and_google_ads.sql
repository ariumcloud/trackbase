-- Migração: Suporte a Push Notifications (Web Push / VAPID) e Google Ads
-- Trackbase 2026

CREATE TABLE IF NOT EXISTS public.utm_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.utm_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_push_workspace_endpoint UNIQUE (workspace_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_utm_push_workspace ON public.utm_push_subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_utm_push_user ON public.utm_push_subscriptions (user_id);

ALTER TABLE public.utm_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas inscrições de push no workspace"
ON public.utm_push_subscriptions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.utm_members m
        WHERE m.workspace_id = utm_push_subscriptions.workspace_id
          AND m.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.utm_members m
        WHERE m.workspace_id = utm_push_subscriptions.workspace_id
          AND m.user_id = auth.uid()
    )
);

-- Adiciona coluna refresh_token_ciphertext em utm_credentials caso não exista
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'utm_credentials' 
          AND column_name = 'refresh_token_ciphertext'
    ) THEN
        ALTER TABLE public.utm_credentials ADD COLUMN refresh_token_ciphertext TEXT;
    END IF;
END $$;
