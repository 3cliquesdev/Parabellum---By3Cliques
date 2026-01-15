import { TourStep } from "../TourProvider";

export const INBOX_TOUR_ID = "inbox-v1";

export const INBOX_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="inbox-filters"]',
    title: "🔍 Filtros de Conversas",
    content: "Filtre suas conversas por status: Abertas, Minhas, Aguardando, Fechadas. Use os filtros para encontrar rapidamente o que precisa.",
  },
  {
    target: '[data-tour="inbox-conversation-list"]',
    title: "💬 Lista de Conversas",
    content: "Aqui aparecem todas as conversas. Conversas não lidas têm destaque. Clique em uma para abrir o chat. O contador mostra mensagens não lidas.",
  },
  {
    target: '[data-tour="inbox-chat-area"]',
    title: "📝 Área de Chat",
    content: "Visualize o histórico de mensagens e responda aos clientes. Use emojis, anexe arquivos e formate o texto. As mensagens são enviadas em tempo real.",
  },
  {
    target: '[data-tour="inbox-contact-panel"]',
    title: "👤 Painel do Contato",
    content: "Veja informações do cliente: dados de contato, histórico de compras, tickets relacionados. Edite os dados diretamente aqui.",
  },
];
