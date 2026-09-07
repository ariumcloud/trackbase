-- Adicionar coluna push_settings na tabela utm_workspaces
-- Permite ao usuário personalizar o título, mensagem e prefixo das notificações de venda

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'utm_workspaces' 
          AND column_name = 'push_settings'
    ) THEN
        ALTER TABLE public.utm_workspaces ADD COLUMN push_settings JSONB DEFAULT '{
            "title_template": "💰 Venda Realizada: {valor}!",
            "body_template": "Opa, caiu mais uma! {produto} via {provedor}.",
            "show_buyer": true
        }'::jsonb;
    END IF;
END $$;
