-- =============================================
-- INTEGRAÇÃO INSTAGRAM + CRM
-- Tabelas para gerenciar comentários, DMs e conversão em deals
-- =============================================

-- 1. Contas Instagram Business conectadas
CREATE TABLE public.instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_user_id VARCHAR(100) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Posts do Instagram
CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  instagram_post_id VARCHAR(100) UNIQUE NOT NULL,
  caption TEXT,
  media_type VARCHAR(50),
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Comentários do Instagram
CREATE TABLE public.instagram_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_comment_id VARCHAR(100) UNIQUE NOT NULL,
  post_id UUID REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
  instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  instagram_user_id VARCHAR(100),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ,
  replied BOOLEAN DEFAULT FALSE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Respostas aos comentários
CREATE TABLE public.instagram_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.instagram_comments(id) ON DELETE CASCADE,
  instagram_reply_id VARCHAR(100) UNIQUE,
  text TEXT NOT NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mensagens Diretas (DMs)
CREATE TABLE public.instagram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  conversation_id VARCHAR(100) NOT NULL,
  message_id VARCHAR(100) UNIQUE NOT NULL,
  from_username VARCHAR(100),
  from_instagram_id VARCHAR(100),
  text TEXT,
  media_url TEXT,
  is_from_business BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ,
  read BOOLEAN DEFAULT FALSE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Log de sincronização
CREATE TABLE public.instagram_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_instagram_posts_account ON public.instagram_posts(instagram_account_id);
CREATE INDEX idx_instagram_posts_timestamp ON public.instagram_posts(timestamp DESC);
CREATE INDEX idx_instagram_comments_post ON public.instagram_comments(post_id);
CREATE INDEX idx_instagram_comments_account ON public.instagram_comments(instagram_account_id);
CREATE INDEX idx_instagram_comments_status ON public.instagram_comments(status);
CREATE INDEX idx_instagram_comments_assigned ON public.instagram_comments(assigned_to);
CREATE INDEX idx_instagram_comments_timestamp ON public.instagram_comments(timestamp DESC);
CREATE INDEX idx_instagram_messages_account ON public.instagram_messages(instagram_account_id);
CREATE INDEX idx_instagram_messages_conversation ON public.instagram_messages(conversation_id);
CREATE INDEX idx_instagram_messages_status ON public.instagram_messages(status);
CREATE INDEX idx_instagram_messages_assigned ON public.instagram_messages(assigned_to);
CREATE INDEX idx_instagram_messages_timestamp ON public.instagram_messages(timestamp DESC);
CREATE INDEX idx_instagram_sync_log_account ON public.instagram_sync_log(instagram_account_id);

-- =============================================
-- RLS POLICIES (usando has_role)
-- =============================================

ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_sync_log ENABLE ROW LEVEL SECURITY;

-- Instagram Accounts
CREATE POLICY "admins_managers_can_manage_instagram_accounts"
ON public.instagram_accounts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "authenticated_can_view_instagram_accounts"
ON public.instagram_accounts FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Instagram Posts
CREATE POLICY "authenticated_can_view_instagram_posts"
ON public.instagram_posts FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins_managers_can_manage_instagram_posts"
ON public.instagram_posts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Instagram Comments
CREATE POLICY "users_can_view_instagram_comments"
ON public.instagram_comments FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'support_manager'::app_role)
  )
);

CREATE POLICY "users_can_update_assigned_comments"
ON public.instagram_comments FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "admins_can_insert_instagram_comments"
ON public.instagram_comments FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "admins_can_delete_instagram_comments"
ON public.instagram_comments FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Instagram Comment Replies
CREATE POLICY "users_can_view_instagram_replies"
ON public.instagram_comment_replies FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    sent_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "users_can_insert_instagram_replies"
ON public.instagram_comment_replies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND sent_by = auth.uid());

-- Instagram Messages
CREATE POLICY "users_can_view_instagram_messages"
ON public.instagram_messages FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'support_manager'::app_role)
  )
);

CREATE POLICY "users_can_update_assigned_messages"
ON public.instagram_messages FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND (
    assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "admins_can_insert_instagram_messages"
ON public.instagram_messages FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "admins_can_delete_instagram_messages"
ON public.instagram_messages FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Sync Log
CREATE POLICY "admins_can_manage_sync_logs"
ON public.instagram_sync_log FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_instagram_accounts_updated_at
  BEFORE UPDATE ON public.instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_posts_updated_at
  BEFORE UPDATE ON public.instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_comments_updated_at
  BEFORE UPDATE ON public.instagram_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instagram_messages_updated_at
  BEFORE UPDATE ON public.instagram_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HABILITAR REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_messages;