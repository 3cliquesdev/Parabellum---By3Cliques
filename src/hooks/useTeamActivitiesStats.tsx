import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, subDays, differenceInDays } from "date-fns";

export interface TeamActivitiesStats {
  calls: number;
  emails: number;
  meetings: number;
  tasks: number;
  callsPrevious: number;
  emailsPrevious: number;
  meetingsPrevious: number;
  tasksPrevious: number;
  callsChange: number;
  emailsChange: number;
  meetingsChange: number;
  tasksChange: number;
  total: number;
  totalPrevious: number;
  totalChange: number;
}

const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const getPreviousPeriod = (range: DateRange): DateRange => {
  if (!range.from || !range.to) return { from: undefined, to: undefined };
  
  const duration = differenceInDays(range.to, range.from);
  return {
    from: subDays(range.from, duration + 1),
    to: subDays(range.from, 1)
  };
};

export function useTeamActivitiesStats(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ["team-activities-stats", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<TeamActivitiesStats> => {
      if (!dateRange?.from || !dateRange?.to) {
        return getEmptyStats();
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      
      const previousPeriod = getPreviousPeriod(dateRange);
      const prevStartDate = previousPeriod.from ? startOfDay(previousPeriod.from).toISOString() : null;
      const prevEndDate = previousPeriod.to ? endOfDay(previousPeriod.to).toISOString() : null;

      const [{ data: currentActivities }, { data: prevActivities }] = await Promise.all([
        supabase
          .from("activities")
          .select("type")
          .eq("completed", true)
          .gte("completed_at", startDate)
          .lte("completed_at", endDate),
        prevStartDate && prevEndDate
          ? supabase
              .from("activities")
              .select("type")
              .eq("completed", true)
              .gte("completed_at", prevStartDate)
              .lte("completed_at", prevEndDate)
          : Promise.resolve({ data: [] })
      ]);

      const countByType = (activities: { type: string }[] | null, type: string) =>
        (activities || []).filter(a => a.type === type).length;

      const calls = countByType(currentActivities, "call");
      const emails = countByType(currentActivities, "email");
      const meetings = countByType(currentActivities, "meeting");
      const tasks = countByType(currentActivities, "task");
      const total = (currentActivities || []).length;

      const callsPrevious = countByType(prevActivities, "call");
      const emailsPrevious = countByType(prevActivities, "email");
      const meetingsPrevious = countByType(prevActivities, "meeting");
      const tasksPrevious = countByType(prevActivities, "task");
      const totalPrevious = (prevActivities || []).length;

      return {
        calls,
        emails,
        meetings,
        tasks,
        callsPrevious,
        emailsPrevious,
        meetingsPrevious,
        tasksPrevious,
        callsChange: calculatePercentChange(calls, callsPrevious),
        emailsChange: calculatePercentChange(emails, emailsPrevious),
        meetingsChange: calculatePercentChange(meetings, meetingsPrevious),
        tasksChange: calculatePercentChange(tasks, tasksPrevious),
        total,
        totalPrevious,
        totalChange: calculatePercentChange(total, totalPrevious)
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 1000 * 60 * 2
  });
}

function getEmptyStats(): TeamActivitiesStats {
  return {
    calls: 0,
    emails: 0,
    meetings: 0,
    tasks: 0,
    callsPrevious: 0,
    emailsPrevious: 0,
    meetingsPrevious: 0,
    tasksPrevious: 0,
    callsChange: 0,
    emailsChange: 0,
    meetingsChange: 0,
    tasksChange: 0,
    total: 0,
    totalPrevious: 0,
    totalChange: 0
  };
}
