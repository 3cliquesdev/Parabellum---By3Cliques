-- Create enum for conversation channels
CREATE TYPE public.conversation_channel AS ENUM ('whatsapp', 'email');

-- Create enum for message sender types
CREATE TYPE public.sender_type AS ENUM ('user', 'contact');

-- Create enum for deal status
CREATE TYPE public.deal_status AS ENUM ('open', 'won', 'lost');

-- Create enum for conversation status
CREATE TYPE public.conversation_status AS ENUM ('open', 'closed');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp_id TEXT,
  avatar_url TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Pipelines table
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Stages table
CREATE TABLE public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  value NUMERIC(15, 2),
  currency TEXT DEFAULT 'USD',
  status public.deal_status DEFAULT 'open' NOT NULL,
  stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  status public.conversation_status DEFAULT 'open' NOT NULL,
  channel public.conversation_channel NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  sender_type public.sender_type NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create open policies for authenticated users (as requested)
CREATE POLICY "Allow authenticated users full access to organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to contacts"
  ON public.contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to pipelines"
  ON public.pipelines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to stages"
  ON public.stages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to deals"
  ON public.deals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to conversations"
  ON public.conversations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deals table
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_contacts_organization ON public.contacts(organization_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_stages_pipeline ON public.stages(pipeline_id);
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_deals_organization ON public.deals(organization_id);
CREATE INDEX idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);