import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // 500ms

/**
 * Helper: Generate signed URL with retry
 */
async function createSignedUrlWithRetry(
  supabase: any,
  bucket: string,
  path: string,
  expiresIn: number,
  attachmentId: string
): Promise<{ url: string | null; error: string | null }> {
  let lastError: string | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[get-media-url] Attempt ${attempt}/${MAX_RETRIES} for ${attachmentId}`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        lastError = error.message;
        console.warn(`[get-media-url] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
          continue;
        }
      } else if (data?.signedUrl) {
        console.log(`[get-media-url] ✅ Success on attempt ${attempt}`);
        return { url: data.signedUrl, error: null };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[get-media-url] Exception on attempt ${attempt}:`, lastError);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
      }
    }
  }
  
  return { url: null, error: lastError || 'Failed to generate URL after retries' };
}

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
      console.warn('[get-media-url] Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header', retriable: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('[get-media-url] Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', retriable: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get('attachmentId');
    const expiresIn = parseInt(url.searchParams.get('expiresIn') || '3600', 10); // Default 1 hour

    if (!attachmentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'attachmentId is required', retriable: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-media-url] Request for attachment: ${attachmentId}, expiresIn: ${expiresIn}`);

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
      console.error('[get-media-url] Attachment not found:', attachmentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Attachment not found', retriable: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify storage path exists
    if (!attachment.storage_path || !attachment.storage_bucket) {
      console.error('[get-media-url] Attachment missing storage info:', attachmentId);
      return new Response(
        JSON.stringify({ success: false, error: 'Attachment has no storage path', retriable: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', attachment.conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[get-media-url] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found', retriable: false }),
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
      roles.includes('general_manager') ||
      roles.includes('agent'); // Allow agents to view media

    if (!hasAccess) {
      console.warn('[get-media-url] Access denied for user:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied to this attachment', retriable: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use transcoded path if available, otherwise original
    const storagePath = attachment.transcoded_path || attachment.storage_path;

    // Generate signed URL with retry
    const { url: signedUrl, error: signedUrlError } = await createSignedUrlWithRetry(
      supabase,
      attachment.storage_bucket,
      storagePath,
      validExpiresIn,
      attachmentId
    );

    if (signedUrlError || !signedUrl) {
      console.error('[get-media-url] Failed to generate signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: signedUrlError || 'Failed to generate URL',
          retriable: true // Client can retry
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-media-url] ✅ Generated signed URL for ${attachmentId}, expires in ${validExpiresIn}s`);

    return new Response(
      JSON.stringify({
        success: true,
        attachment: {
          id: attachment.id,
          filename: attachment.original_filename,
          mimeType: attachment.mime_type,
          size: attachment.file_size,
          status: attachment.status,
          url: signedUrl,
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
    console.error('[get-media-url] ❌ Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error', 
        details: errorMessage,
        retriable: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
