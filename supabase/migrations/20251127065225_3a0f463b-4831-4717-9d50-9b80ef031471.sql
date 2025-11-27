-- Add message delivery status tracking
CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'failed');

ALTER TABLE public.messages
ADD COLUMN status message_status DEFAULT 'sent',
ADD COLUMN delivery_error TEXT;