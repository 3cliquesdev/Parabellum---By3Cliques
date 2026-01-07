import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get('attachmentId');
    const expiresIn = parseInt(url.searchParams.get('expiresIn') || '3600', 10); // Default 1 hour

    if (!attachmentId) {
      return new Response(
        JSON.stringify({ error: 'attachmentId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate expiresIn (max 24 hours)
    const validExpiresIn = Math.min(Math.max(expiresIn, 60), 86400);

    // Get attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('media_attachments')
      .select(`
        id,
        storage_path,
        storage_bucket,
        mime_type,
        original_filename,
        file_size,
        status,
        transcoded_path,
        waveform_data,
        duration_seconds,
        conversation_id
      `)
      .eq('id', attachmentId)
      .single();

    if (attachmentError || !attachment) {
      console.error('Attachment not found:', attachmentError);
      return new Response(
        JSON.stringify({ error: 'Attachment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', attachment.conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user has permission (via RLS or role)
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    const hasAccess = 
      conversation.assigned_to === user.id ||
      roles.includes('admin') ||
      roles.includes('manager') ||
      roles.includes('support_manager') ||
      roles.includes('general_manager');

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this attachment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use transcoded path if available, otherwise original
    const storagePath = attachment.transcoded_path || attachment.storage_path;

    // Generate signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(storagePath, validExpiresIn);

    if (signedUrlError) {
      console.error('Failed to generate signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Generated signed URL for attachment ${attachmentId}, expires in ${validExpiresIn}s`);

    return new Response(
      JSON.stringify({
        success: true,
        attachment: {
          id: attachment.id,
          filename: attachment.original_filename,
          mimeType: attachment.mime_type,
          size: attachment.file_size,
          status: attachment.status,
          url: signedUrlData.signedUrl,
          expiresIn: validExpiresIn,
          waveformData: attachment.waveform_data,
          durationSeconds: attachment.duration_seconds,
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': `private, max-age=${Math.floor(validExpiresIn * 0.9)}`,
        } 
      }
    );

  } catch (error: unknown) {
    console.error('❌ Get media URL error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
