import { useState } from "react";
import { useInstagramConversations, useInstagramMessages, useSendInstagramMessage, useMarkMessagesAsRead } from "@/hooks/instagram";
import { useInstagramAccounts } from "@/hooks/instagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Send, 
  Search,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CreateDealFromInstagramDialog from "@/components/instagram/CreateDealFromInstagramDialog";

const InstagramMessages = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDeal, setShowCreateDeal] = useState(false);

  const { data: conversations, isLoading: loadingConversations } = useInstagramConversations();
  const { data: messages, isLoading: loadingMessages } = useInstagramMessages(selectedConversationId || "");
  const { mutate: sendMessage, isPending: isSending } = useSendInstagramMessage();
  const { mutate: markAsRead } = useMarkMessagesAsRead();
  const { data: accounts } = useInstagramAccounts();

  const activeAccount = accounts?.find((a) => a.is_active);
  const selectedConversation = conversations?.find((c) => c.conversation_id === selectedConversationId);

  const filteredConversations = conversations?.filter((conv) => {
    if (!searchTerm) return true;
    return conv.from_username?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    // Mark messages as read
    markAsRead(conversationId);
  };

  const handleSendMessage = () => {
    if (!selectedConversationId || !messageText.trim() || !selectedConversation || !activeAccount) return;
    
    sendMessage(
      {
        conversationId: selectedConversationId,
        text: messageText,
        accountId: activeAccount.id,
      },
      {
        onSuccess: () => setMessageText(""),
      }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-350px)]">
      {/* Left: Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversas</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-500px)]">
            {loadingConversations ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredConversations?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations?.map((conv) => (
                  <div
                    key={conv.conversation_id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedConversationId === conv.conversation_id ? "bg-muted" : ""
                    }`}
                    onClick={() => handleSelectConversation(conv.conversation_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {conv.from_username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">@{conv.from_username || "Usuário"}</span>
                          {conv.unread_count > 0 && (
                            <Badge variant="default" className="text-xs">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {conv.last_message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right: Messages */}
      <Card className="lg:col-span-2 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {selectedConversation.from_username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">@{selectedConversation.from_username || "Usuário"}</CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowCreateDeal(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Criar Deal
                  </Button>
                  <a
                    href={`https://instagram.com/${selectedConversation.from_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Perfil
                    </Button>
                  </a>
                </div>
              </div>
            </CardHeader>
            
            {/* Messages Area */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-550px)] p-4">
                {loadingMessages ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-3/4" />
                    ))}
                  </div>
                ) : messages?.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>Nenhuma mensagem</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_from_business ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            msg.is_from_business
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.text}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.is_from_business
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {msg.timestamp && format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>

            {/* Input Area */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={isSending || !messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Você só pode responder se o cliente enviou a primeira mensagem
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa para ver as mensagens</p>
            </div>
          </div>
        )}
      </Card>

      {/* Create Deal Dialog */}
      {selectedConversation && (
        <CreateDealFromInstagramDialog
          open={showCreateDeal}
          onOpenChange={setShowCreateDeal}
          sourceType="message"
          sourceId={selectedConversation.conversation_id}
          username={selectedConversation.from_username || ""}
          initialNotes={selectedConversation.last_message || ""}
        />
      )}
    </div>
  );
};

export default InstagramMessages;
