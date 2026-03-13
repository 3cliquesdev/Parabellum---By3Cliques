import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Download Meta WhatsApp Media
 * 
 * Receives a Meta media ID, downloads the file from Meta's API,
 * uploads to Supabase Storage, and creates a media_attachments record.
 */

interface DownloadRequest {
  meta_media_id: string;
  message_id: string;
  media_type: string;
  instance_id: string;
  conversation_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body: DownloadRequest = await req.json();
    const { meta_media_id, message_id, media_type, instance_id, conversation_id } = body;

    console.log("[download-meta-media] 📥 Starting download:", { meta_media_id, message_id, media_type });

    if (!meta_media_id || !message_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar access token da instância
    const { data: instance } = await supabase
      .from("whatsapp_meta_instances")
      .select("access_token")
      .eq("id", instance_id)
      .single();

    const accessToken = instance?.access_token || Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!accessToken) {
      console.error("[download-meta-media] ❌ No access token available");
      return new Response(
        JSON.stringify({ error: "No access token configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get media URL from Meta API
    console.log("[download-meta-media] 🔍 Fetching media URL from Meta...");
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v21.0/${meta_media_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!mediaInfoResponse.ok) {
      const errorText = await mediaInfoResponse.text();
      console.error("[download-meta-media] ❌ Failed to get media info:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get media URL from Meta", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaInfo = await mediaInfoResponse.json();
    const mediaUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type || getMimeTypeFromMediaType(media_type);

    console.log("[download-meta-media] 📍 Media URL obtained:", mediaUrl?.slice(0, 50) + "...");

    // Step 2: Download the actual file
    console.log("[download-meta-media] ⬇️ Downloading file...");
    const fileResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error("[download-meta-media] ❌ Failed to download file:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to download media file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileExtension = getExtensionFromMimeType(mimeType);
    const fileName = `${message_id}_${Date.now()}${fileExtension}`;
    const storageBucket = 'chat-attachments';
    const storagePath = `whatsapp/${fileName}`;

    console.log("[download-meta-media] 📦 File size:", fileBuffer.byteLength, "bytes");

    // Step 3: Upload to Supabase Storage
    console.log("[download-meta-media] ⬆️ Uploading to Storage bucket:", storageBucket);
    const { error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[download-meta-media] ❌ Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload to storage", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[download-meta-media] ✅ Uploaded to bucket:", storageBucket, "path:", storagePath);

    // Step 4: Create media_attachments record with conversation_id for permission checks
    const insertData: Record<string, any> = {
      message_id: message_id,
      original_filename: fileName,
      mime_type: mimeType,
      file_size: fileBuffer.byteLength,
      storage_path: storagePath,
      storage_bucket: storageBucket,
      status: 'ready',
    };

    // Add conversation_id if provided (needed for get-media-url permission checks)
    if (conversation_id) {
      insertData.conversation_id = conversation_id;
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from("media_attachments")
      .insert(insertData)
      .select("id")
      .single();

    if (attachmentError) {
      console.error("[download-meta-media] ⚠️ Failed to create attachment record:", attachmentError);
    } else {
      console.log("[download-meta-media] ✅ Attachment record created:", attachment?.id);
    }

    // Step 5: Update message with storage_path reference (NOT public URL)
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        attachment_url: `storage:${storageBucket}/${storagePath}`,
        attachment_type: media_type,
      })
      .eq("id", message_id);

    if (updateError) {
      console.error("[download-meta-media] ⚠️ Failed to update message:", updateError);
    } else {
      console.log("[download-meta-media] ✅ Message updated with storage reference");
    }

    return new Response(
      JSON.stringify({
        success: true,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        attachment_id: attachment?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[download-meta-media] ❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getMimeTypeFromMediaType(mediaType: string): string {
  switch (mediaType) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/ogg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/octet-stream";
    case "sticker":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[mimeType] || ".bin";
}
