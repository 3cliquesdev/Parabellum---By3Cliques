import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlaybookStepViewer } from '@/components/playbook/PlaybookStepViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface JourneyStep {
  id: string;
  step_name: string;
  video_url?: string;
  rich_content?: string;
  attachments?: any[];
  video_completed?: boolean;
  completed: boolean;
  contact_id: string;
}

interface OnboardingStepModalProps {
  step: JourneyStep;
  onClose: () => void;
}

export function OnboardingStepModal({ step, onClose }: OnboardingStepModalProps) {
  const [videoCompleted, setVideoCompleted] = useState(step.video_completed || false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleVideoEnded = async () => {
    if (videoCompleted) return; // Already marked as completed
    
    setVideoCompleted(true);
    
    try {
      const { error } = await supabase
        .from('customer_journey_steps')
        .update({ 
          video_completed: true, 
          video_completed_at: new Date().toISOString() 
        })
        .eq('id', step.id);

      if (error) throw error;

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['journey-steps', step.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-timeline', step.contact_id] });
    } catch (error: any) {
      console.error('Error updating video completion:', error);
    }
  };

  const handleMarkComplete = async () => {
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('customer_journey_steps')
        .update({ 
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', step.id);

      if (error) throw error;

      toast({
        title: '✅ Etapa Concluída',
        description: 'Parabéns por completar esta etapa do onboarding!',
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['journey-steps', step.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-timeline', step.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', step.contact_id] });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Erro ao marcar etapa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const canMarkComplete = !step.video_url || videoCompleted;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <PlaybookStepViewer
          label={step.step_name}
          video_url={step.video_url}
          rich_content={step.rich_content}
          attachments={step.attachments}
          onVideoEnded={handleVideoEnded}
        />

        {!step.completed && (
          <DialogFooter>
            <Button 
              onClick={handleMarkComplete}
              disabled={!canMarkComplete || isUpdating}
              className={videoCompleted ? 'animate-pulse bg-green-500 hover:bg-green-600' : ''}
              size="lg"
            >
              {!canMarkComplete && '🎬 Assista o vídeo primeiro'}
              {canMarkComplete && !isUpdating && '✅ Marcar como Concluída'}
              {isUpdating && 'Salvando...'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
