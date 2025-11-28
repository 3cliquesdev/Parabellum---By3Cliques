import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { useAuth } from "./useAuth";

export interface ChurnRisk {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  last_contact_date: string | null;
  days_since_contact: number;
  current_health: "green" | "yellow" | "red";
  consultant_id: string | null;
  consultant_name: string | null;
  reason: string;
}

export interface ChurnAnalytics {
  healthDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
  risksByConsultant: {
    consultantId: string | null;
    consultantName: string;
    riskCount: number;
    clients: ChurnRisk[];
  }[];
  topRisks: ChurnRisk[];
  totalCustomers: number;
  totalAtRisk: number;
  riskPercentage: number;
}

export function useChurnAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["churn-analytics"],
    queryFn: async (): Promise<ChurnAnalytics> => {
      // Fetch ALL customers (not filtered by consultant)
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          company,
          email,
          phone,
          last_contact_date,
          consultant_id,
          status
        `)
        .eq("status", "customer");

      if (error) throw error;

      // Fetch consultant profiles
      const { data: consultants } = await supabase
        .from("profiles")
        .select("id, full_name");

      const consultantMap = new Map(
        consultants?.map(c => [c.id, c.full_name]) || []
      );

      // Calculate health scores for all customers
      const now = new Date();
      const risks: ChurnRisk[] = [];
      let greenCount = 0;
      let yellowCount = 0;
      let redCount = 0;

      contacts?.forEach((contact) => {
        const lastContactDate = contact.last_contact_date
          ? new Date(contact.last_contact_date)
          : null;
        const daysSinceContact = lastContactDate
          ? differenceInDays(now, lastContactDate)
          : 9999;

        let health: "green" | "yellow" | "red";
        let reason: string;

        if (daysSinceContact <= 15) {
          health = "green";
          reason = "Contato recente";
          greenCount++;
        } else if (daysSinceContact <= 30) {
          health = "yellow";
          reason = `${daysSinceContact} dias sem contato - Atenção`;
          yellowCount++;
        } else {
          health = "red";
          reason = `${daysSinceContact} dias sem contato - Risco Crítico`;
          redCount++;
        }

        const risk: ChurnRisk = {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          company: contact.company,
          email: contact.email,
          phone: contact.phone,
          last_contact_date: contact.last_contact_date,
          days_since_contact: daysSinceContact,
          current_health: health,
          consultant_id: contact.consultant_id,
          consultant_name: contact.consultant_id
            ? consultantMap.get(contact.consultant_id) || "Sem Consultor"
            : "Sem Consultor",
          reason,
        };

        // Only include yellow and red as "at risk"
        if (health === "yellow" || health === "red") {
          risks.push(risk);
        }
      });

      // Sort risks by severity (red first, then yellow) and days
      risks.sort((a, b) => {
        if (a.current_health === "red" && b.current_health !== "red") return -1;
        if (a.current_health !== "red" && b.current_health === "red") return 1;
        return b.days_since_contact - a.days_since_contact;
      });

      // Group by consultant
      const risksByConsultantMap = new Map<string | null, ChurnRisk[]>();
      risks.forEach((risk) => {
        const key = risk.consultant_id;
        if (!risksByConsultantMap.has(key)) {
          risksByConsultantMap.set(key, []);
        }
        risksByConsultantMap.get(key)!.push(risk);
      });

      const risksByConsultant = Array.from(risksByConsultantMap.entries())
        .map(([consultantId, clients]) => ({
          consultantId,
          consultantName: consultantId
            ? consultantMap.get(consultantId) || "Sem Consultor"
            : "Sem Consultor",
          riskCount: clients.length,
          clients,
        }))
        .sort((a, b) => b.riskCount - a.riskCount);

      const totalCustomers = contacts?.length || 0;
      const totalAtRisk = risks.length;
      const riskPercentage =
        totalCustomers > 0 ? (totalAtRisk / totalCustomers) * 100 : 0;

      return {
        healthDistribution: {
          green: greenCount,
          yellow: yellowCount,
          red: redCount,
        },
        risksByConsultant,
        topRisks: risks.slice(0, 10),
        totalCustomers,
        totalAtRisk,
        riskPercentage,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
