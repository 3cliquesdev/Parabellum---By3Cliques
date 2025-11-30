import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileSkill {
  profile_id: string;
  skill_id: string;
  proficiency_level: string;
  skill: {
    id: string;
    name: string;
    color: string;
  };
}

export function useProfileSkills(profileId: string | undefined) {
  return useQuery({
    queryKey: ["profile-skills", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("profiles_skills")
        .select(`
          profile_id,
          skill_id,
          proficiency_level,
          skills (
            id,
            name,
            color
          )
        `)
        .eq("profile_id", profileId);

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        skill: Array.isArray(item.skills) ? item.skills[0] : item.skills
      })) as ProfileSkill[];
    },
    enabled: !!profileId,
  });
}
