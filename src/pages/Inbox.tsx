import { useState } from "react";
import { useConversations } from "@/hooks/useConversations";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import ContactDetailsSidebar from "@/components/ContactDetailsSidebar";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
};

export default function Inbox() {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const { data: conversations, isLoading } = useConversations();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations || []}
        activeConversationId={activeConversation?.id || null}
        onSelectConversation={setActiveConversation}
      />
      <ChatWindow conversation={activeConversation} />
      <ContactDetailsSidebar conversation={activeConversation} />
    </div>
  );
}
