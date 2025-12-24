export interface OctadeskConversation {
  id: string;
  roomKey: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  agentName: string;
  department: string;
  publicTags: string[];
  satisfaction: 'satisfied' | 'unsatisfied' | null;
  surveyComment: string | null;
  messagesCount: number;
  createdAt: Date;
  closedAt: Date | null;
  status: string;
}

export interface OctadeskFilters {
  satisfaction: 'all' | 'satisfied' | 'unsatisfied' | 'none';
  minMessages: number;
  startDate: Date | null;
  endDate: Date | null;
  department: string | null;
}

export function parseOctadeskExport(data: unknown[]): OctadeskConversation[] {
  if (!Array.isArray(data)) {
    throw new Error('O arquivo JSON deve conter um array de conversas');
  }

  return data.map((item: any, index: number) => {
    try {
      // Extract client info
      const client = item.client || {};
      const clientName = client.name || client.email || 'Cliente Desconhecido';
      const clientEmail = client.email || null;
      const clientPhone = client.phone || client.whatsapp || null;

      // Extract agent info
      const agent = item.agent || item.lastOperator || {};
      const agentName = agent.name || 'Agente Desconhecido';

      // Extract department
      const group = item.group || {};
      const department = group.name || 'Sem Departamento';

      // Extract tags
      const publicTags: string[] = Array.isArray(item.publicTags) 
        ? item.publicTags.map((tag: any) => typeof tag === 'string' ? tag : tag.name || tag.label || String(tag))
        : [];

      // Extract satisfaction survey
      const survey = item.survey || {};
      let satisfaction: 'satisfied' | 'unsatisfied' | null = null;
      if (survey.response === 'satisfied' || survey.response === 1 || survey.response === '1') {
        satisfaction = 'satisfied';
      } else if (survey.response === 'unsatisfied' || survey.response === 0 || survey.response === '0') {
        satisfaction = 'unsatisfied';
      }
      const surveyComment = survey.comment || null;

      // Extract messages count
      const messagesCount = item.messagesCount || item.messages?.length || 0;

      // Extract dates
      const createdAt = new Date(item.createdAt?.$date || item.createdAt || item.created_at || Date.now());
      const closedAt = item.closedAt?.$date || item.closedAt || item.closed_at 
        ? new Date(item.closedAt?.$date || item.closedAt || item.closed_at)
        : null;

      // Extract room key (ID used to fetch messages via API)
      const roomKey = item._id?.$oid || item._id || item.id || item.roomKey || item.key || `unknown-${index}`;

      // Extract status
      const status = item.status || 'unknown';

      return {
        id: roomKey,
        roomKey,
        clientName,
        clientEmail,
        clientPhone,
        agentName,
        department,
        publicTags,
        satisfaction,
        surveyComment,
        messagesCount,
        createdAt,
        closedAt,
        status,
      };
    } catch (error) {
      console.error(`Erro ao parsear conversa ${index}:`, error);
      return {
        id: `error-${index}`,
        roomKey: `error-${index}`,
        clientName: 'Erro no Parse',
        clientEmail: null,
        clientPhone: null,
        agentName: 'Erro',
        department: 'Erro',
        publicTags: [],
        satisfaction: null,
        surveyComment: null,
        messagesCount: 0,
        createdAt: new Date(),
        closedAt: null,
        status: 'error',
      };
    }
  }).filter(conv => conv.roomKey && !conv.roomKey.startsWith('error-'));
}

export function filterConversations(
  conversations: OctadeskConversation[],
  filters: OctadeskFilters
): OctadeskConversation[] {
  return conversations.filter(conv => {
    // Filter by satisfaction
    if (filters.satisfaction !== 'all') {
      if (filters.satisfaction === 'none' && conv.satisfaction !== null) return false;
      if (filters.satisfaction === 'satisfied' && conv.satisfaction !== 'satisfied') return false;
      if (filters.satisfaction === 'unsatisfied' && conv.satisfaction !== 'unsatisfied') return false;
    }

    // Filter by minimum messages
    if (conv.messagesCount < filters.minMessages) return false;

    // Filter by date range
    if (filters.startDate && conv.createdAt < filters.startDate) return false;
    if (filters.endDate && conv.createdAt > filters.endDate) return false;

    // Filter by department
    if (filters.department && conv.department !== filters.department) return false;

    return true;
  });
}

export function getUniqueDepartments(conversations: OctadeskConversation[]): string[] {
  const departments = new Set(conversations.map(c => c.department));
  return Array.from(departments).sort();
}

export function getUniqueTags(conversations: OctadeskConversation[]): string[] {
  const tags = new Set<string>();
  conversations.forEach(c => c.publicTags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
}
