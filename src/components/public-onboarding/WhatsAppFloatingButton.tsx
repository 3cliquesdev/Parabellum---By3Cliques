import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

interface WhatsAppFloatingButtonProps {
  phone: string;
  customerName: string;
}

export function WhatsAppFloatingButton({ phone, customerName }: WhatsAppFloatingButtonProps) {
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
    `Olá! Sou ${customerName} e preciso de ajuda com meu onboarding.`
  )}`;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-full shadow-lg shadow-emerald-500/30 transition-colors group"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.div>
      <span className="font-medium hidden sm:inline group-hover:inline transition-all">
        WhatsApp
      </span>
    </motion.a>
  );
}
