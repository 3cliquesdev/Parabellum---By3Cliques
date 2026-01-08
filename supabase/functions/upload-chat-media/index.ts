import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed MIME types (base types without parameters)
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm',
  'video/mp4', 'video/webm',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Helper to check if MIME type is allowed (handles types with codecs like "audio/webm;codecs=opus")
function isAllowedMimeType(mimeType: string): boolean {
  // Extract base MIME type (before any semicolon parameters)
  const baseMimeType = mimeType.split(';')[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.includes(baseMimeType);
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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const messageId = formData.get('messageId') as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (handles types with codecs like "audio/webm;codecs=opus")
    if (!isAllowedMimeType(file.type)) {
      return new Response(
        JSON.stringify({ error: `File type ${file.type} not allowed` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${conversationId}/${timestamp}_${sanitizedFilename}`;

    console.log(`📁 Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);
    console.log(`📂 Storage path: ${storagePath}`);

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ File uploaded successfully:', uploadData.path);

    // Determine initial status
    const isAudio = file.type.startsWith('audio/');
    const needsProcessing = isAudio && file.type === 'audio/ogg';
    const initialStatus = needsProcessing ? 'processing' : 'ready';

    // Create media_attachments record
    const { data: attachment, error: attachmentError } = await supabase
      .from('media_attachments')
      .insert({
        message_id: messageId || null,
        conversation_id: conversationId,
        uploaded_by: user.id,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        storage_bucket: 'chat-attachments',
        status: initialStatus,
      })
      .select()
      .single();

    if (attachmentError) {
      console.error('Attachment record error:', attachmentError);
      // Clean up uploaded file
      await supabase.storage.from('chat-attachments').remove([storagePath]);
      return new Response(
        JSON.stringify({ error: 'Failed to create attachment record', details: attachmentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Attachment record created:', attachment.id);

    // Generate signed URL for immediate access (1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
    }

    // If OGG audio, trigger transcoding (future enhancement)
    if (needsProcessing) {
      console.log('🔄 Audio transcoding needed for:', attachment.id);
      // TODO: Trigger transcode-audio function
      // For now, mark as ready since browsers support OGG
      await supabase
        .from('media_attachments')
        .update({ status: 'ready' })
        .eq('id', attachment.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        attachment: {
          id: attachment.id,
          filename: attachment.original_filename,
          mimeType: attachment.mime_type,
          size: attachment.file_size,
          status: 'ready',
          url: signedUrlData?.signedUrl || null,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
