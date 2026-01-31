/**
 * Audio Transcoder - Converts WebM audio to OGG/Opus for WhatsApp Meta compatibility
 * 
 * WhatsApp Cloud API only accepts: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg, audio/opus
 * Browsers record in WebM format which is NOT supported
 * 
 * This module uses FFmpeg WASM to transcode audio in the browser
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton FFmpeg instance
let ffmpeg: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/**
 * Get or initialize the FFmpeg instance
 * Uses lazy loading to avoid bundle size impact on initial load
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    console.log('[AudioTranscoder] ✅ FFmpeg already loaded');
    return ffmpeg;
  }

  if (loadingPromise) {
    console.log('[AudioTranscoder] ⏳ FFmpeg loading in progress, waiting...');
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('[AudioTranscoder] 🔄 Loading FFmpeg WASM...');
    
    const instance = new FFmpeg();
    
    // Listen for logs from FFmpeg
    instance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });
    
    instance.on('progress', ({ progress, time }) => {
      console.log(`[FFmpeg] Progress: ${Math.round(progress * 100)}% (${time}ms)`);
    });
    
    try {
      // Load FFmpeg with multi-threaded support
      // CDN fallback: jsDelivr costuma ser mais estável do que unpkg em alguns ambientes
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      
      console.log('[AudioTranscoder] Fetching FFmpeg core from:', baseURL);
      
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      
      console.log('[AudioTranscoder] Core URLs created, loading instance...');
      
      // Evitar travar indefinidamente em ambientes onde o download do core/wasm falha.
      const LOAD_TIMEOUT_MS = 15000;
      await Promise.race([
        instance.load({ coreURL, wasmURL }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FFmpeg load timeout')), LOAD_TIMEOUT_MS)
        ),
      ]);
      
      console.log('[AudioTranscoder] ✅ FFmpeg loaded successfully');
      ffmpeg = instance;
      return instance;
    } catch (error) {
      console.error('[AudioTranscoder] ❌ Failed to load FFmpeg:', error);
      loadingPromise = null; // Allow retry
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Check if the audio file needs transcoding for WhatsApp compatibility
 */
export function needsTranscoding(mimeType: string): boolean {
  const metaSupportedTypes = [
    'audio/ogg',
    'audio/opus', 
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/aac',
    'audio/amr',
  ];
  
  // Extract base MIME type (without codecs)
  const baseMime = mimeType.split(';')[0].trim().toLowerCase();
  
  return !metaSupportedTypes.includes(baseMime);
}

/**
 * Transcode audio from WebM to OGG/Opus format
 * 
 * @param audioBlob - The original audio blob (typically WebM)
 * @param originalMimeType - The original MIME type
 * @returns Transcoded audio blob in OGG/Opus format
 */
export async function transcodeToOgg(
  audioBlob: Blob, 
  originalMimeType: string
): Promise<{ blob: Blob; mimeType: string }> {
  // If already compatible, return as-is
  if (!needsTranscoding(originalMimeType)) {
    console.log('[AudioTranscoder] ✅ Audio already compatible, skipping transcoding');
    return { blob: audioBlob, mimeType: originalMimeType };
  }

  console.log('[AudioTranscoder] 🔄 Starting transcoding:', {
    originalType: originalMimeType,
    size: audioBlob.size,
    sizeKB: Math.round(audioBlob.size / 1024),
  });

  try {
    const ff = await getFFmpeg();
    
    if (!ff.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    
    // Determine input extension from MIME type
    const inputExt = originalMimeType.includes('webm') ? 'webm' : 
                     originalMimeType.includes('wav') ? 'wav' : 
                     originalMimeType.includes('mp3') ? 'mp3' : 'raw';
    const inputFileName = `input_${Date.now()}.${inputExt}`;
    const outputFileName = `output_${Date.now()}.ogg`;
    
    console.log('[AudioTranscoder] 📂 Files:', inputFileName, '→', outputFileName);
    
    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(audioBlob);
    console.log('[AudioTranscoder] 📥 Input data size:', inputData.byteLength);
    
    await ff.writeFile(inputFileName, inputData);
    console.log('[AudioTranscoder] ✅ Input file written to virtual FS');
    
    // Transcode to OGG/Opus with optimal settings for voice
    // -c:a libopus = use Opus codec
    // -b:a 48k = 48kbps bitrate (good quality for voice)
    // -ar 48000 = 48kHz sample rate (Opus standard)
    // -ac 1 = mono (smaller file, good for voice)
    console.log('[AudioTranscoder] 🎬 Starting FFmpeg exec...');
    
    await ff.exec([
      '-i', inputFileName,
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-ar', '48000',
      '-ac', '1',
      '-application', 'voip', // Optimized for voice
      '-y', // Overwrite output
      outputFileName
    ]);
    
    console.log('[AudioTranscoder] ✅ FFmpeg exec completed');
    
    // Read output file
    const outputData = await ff.readFile(outputFileName);
    
    // Handle FileData type (can be string or Uint8Array)
    let arrayBuffer: ArrayBuffer;
    if (typeof outputData === 'string') {
      console.log('[AudioTranscoder] 📤 Output is string, encoding...');
      const encoder = new TextEncoder();
      arrayBuffer = encoder.encode(outputData).buffer as ArrayBuffer;
    } else {
      console.log('[AudioTranscoder] 📤 Output data size:', outputData.length);
      
      if (outputData.length === 0) {
        throw new Error('FFmpeg produced empty output');
      }
      
      // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
      arrayBuffer = new ArrayBuffer(outputData.length);
      new Uint8Array(arrayBuffer).set(outputData);
    }
    
    // Clean up virtual filesystem
    try {
      await ff.deleteFile(inputFileName);
      await ff.deleteFile(outputFileName);
    } catch (cleanupError) {
      console.warn('[AudioTranscoder] Cleanup warning:', cleanupError);
    }
    
    // Create output blob
    const outputBlob = new Blob([arrayBuffer], { type: 'audio/ogg' });
    
    const compressionRatio = Math.round((1 - outputBlob.size / audioBlob.size) * 100);
    
    console.log('[AudioTranscoder] ✅ Transcoding complete:', {
      inputSize: `${Math.round(audioBlob.size / 1024)}KB`,
      outputSize: `${Math.round(outputBlob.size / 1024)}KB`,
      compression: `${compressionRatio}%`,
      outputType: 'audio/ogg',
    });
    
    return { blob: outputBlob, mimeType: 'audio/ogg' };
    
  } catch (error) {
    console.error('[AudioTranscoder] ❌ Transcoding failed:', error);
    
    // Fallback: Return original with warning
    console.warn('[AudioTranscoder] ⚠️ Returning original audio - may fail on WhatsApp Meta');
    return { blob: audioBlob, mimeType: originalMimeType };
  }
}

/**
 * Preload FFmpeg to avoid delay on first audio send
 * Call this when user enters the inbox or opens a conversation
 */
export async function preloadFFmpeg(): Promise<boolean> {
  try {
    await getFFmpeg();
    return true;
  } catch (error) {
    console.warn('[AudioTranscoder] Failed to preload FFmpeg:', error);
    return false;
  }
}
