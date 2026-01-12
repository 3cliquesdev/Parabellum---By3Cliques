import { useState } from "react";
import { useInstagramComments, useReplyToComment, useAssignComment, useUpdateCommentStatus } from "@/hooks/instagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageCircle, 
  Send, 
  UserPlus, 
  ExternalLink, 
  Filter,
  Search,
  Image as ImageIcon,
  XCircle,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CreateDealFromInstagramDialog from "@/components/instagram/CreateDealFromInstagramDialog";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Novo", variant: "default" },
  assigned: { label: "Atribuído", variant: "secondary" },
  contacted: { label: "Contactado", variant: "outline" },
  converted: { label: "Convertido", variant: "default" },
  ignored: { label: "Ignorado", variant: "destructive" },
};

const InstagramComments = () => {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filters, setFilters] = useState<{
    status?: string;
    assigned_to?: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDeal, setShowCreateDeal] = useState(false);

  const { data: comments, isLoading } = useInstagramComments(filters);
  const { mutate: replyToComment, isPending: isReplying } = useReplyToComment();
  const { mutate: assignComment } = useAssignComment();
  const { mutate: updateStatus } = useUpdateCommentStatus();

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      return data || [];
    },
  });

  const selectedComment = comments?.find((c) => c.id === selectedCommentId);

  const filteredComments = comments?.filter((comment) => {
    if (!searchTerm) return true;
    return (
      comment.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.text?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleReply = () => {
    if (!selectedCommentId || !replyText.trim()) return;
    replyToComment(
      { commentId: selectedCommentId, text: replyText },
      {
        onSuccess: () => setReplyText(""),
      }
    );
  };

  const handleAssign = (userId: string | null) => {
    if (!selectedCommentId) return;
    assignComment({ commentId: selectedCommentId, userId });
  };

  const handleIgnore = () => {
    if (!selectedCommentId) return;
    updateStatus({ commentId: selectedCommentId, status: "ignored" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-350px)]">
      {/* Left: Comments List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Comentários</CardTitle>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="w-[120px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="new">Novos</SelectItem>
                <SelectItem value="assigned">Atribuídos</SelectItem>
                <SelectItem value="converted">Convertidos</SelectItem>
                <SelectItem value="ignored">Ignorados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-500px)]">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredComments?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum comentário encontrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredComments?.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedCommentId === comment.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedCommentId(comment.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {comment.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">@{comment.username}</span>
                          <Badge variant={statusLabels[comment.status || "new"]?.variant || "default"} className="text-xs">
                            {statusLabels[comment.status || "new"]?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {comment.text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {comment.timestamp && formatDistanceToNow(new Date(comment.timestamp), {
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

      {/* Right: Comment Details */}
      <Card className="lg:col-span-2">
        {selectedComment ? (
          <>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {selectedComment.username?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">@{selectedComment.username}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedComment.timestamp && formatDistanceToNow(new Date(selectedComment.timestamp), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusLabels[selectedComment.status || "new"]?.variant || "default"}>
                    {statusLabels[selectedComment.status || "new"]?.label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Post Preview */}
              {selectedComment.post && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex gap-3">
                  {selectedComment.post.media_url ? (
                    <img
                      src={selectedComment.post.media_url}
                      alt="Post"
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted-foreground/20 rounded flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{selectedComment.post.caption || "Sem legenda"}</p>
                    {selectedComment.post.permalink && (
                      <a
                        href={selectedComment.post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Ver no Instagram <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Comment Text */}
              <div className="mb-4">
                <p className="text-sm font-medium mb-1">Comentário:</p>
                <p className="p-3 bg-muted rounded-lg">{selectedComment.text}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowCreateDeal(true)}
                  disabled={selectedComment.status === "converted"}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Criar Deal
                </Button>

                <Select onValueChange={handleAssign}>
                  <SelectTrigger className="w-[180px]">
                    <UserPlus className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Atribuir para..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Remover atribuição</SelectItem>
                    {teamMembers?.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIgnore}
                  disabled={selectedComment.status === "ignored"}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Ignorar
                </Button>

                <a
                  href={`https://instagram.com/${selectedComment.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Perfil
                  </Button>
                </a>
              </div>

              {/* Reply */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Responder comentário:</p>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Digite sua resposta..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button onClick={handleReply} disabled={isReplying || !replyText.trim()}>
                    <Send className="h-4 w-4 mr-2" />
                    {isReplying ? "Enviando..." : "Enviar Resposta"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Selecione um comentário para ver detalhes</p>
            </div>
          </div>
        )}
      </Card>

      {/* Create Deal Dialog */}
      {selectedComment && (
        <CreateDealFromInstagramDialog
          open={showCreateDeal}
          onOpenChange={setShowCreateDeal}
          sourceType="comment"
          sourceId={selectedComment.id}
          username={selectedComment.username || ""}
          initialNotes={selectedComment.text}
        />
      )}
    </div>
  );
};

export default InstagramComments;
