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
    return ffmpeg;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('[AudioTranscoder] Loading FFmpeg WASM...');
    
    const instance = new FFmpeg();
    
    // Load FFmpeg with multi-threaded support
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    console.log('[AudioTranscoder] FFmpeg loaded successfully');
    ffmpeg = instance;
    return instance;
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
    console.log('[AudioTranscoder] Audio already compatible, skipping transcoding');
    return { blob: audioBlob, mimeType: originalMimeType };
  }

  console.log('[AudioTranscoder] Starting transcoding:', {
    originalType: originalMimeType,
    size: audioBlob.size,
  });

  try {
    const ff = await getFFmpeg();
    
    // Determine input extension from MIME type
    const inputExt = originalMimeType.includes('webm') ? 'webm' : 'raw';
    const inputFileName = `input.${inputExt}`;
    const outputFileName = 'output.ogg';
    
    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(audioBlob);
    await ff.writeFile(inputFileName, inputData);
    
    // Transcode to OGG/Opus with optimal settings for voice
    // -c:a libopus = use Opus codec
    // -b:a 48k = 48kbps bitrate (good quality for voice)
    // -ar 48000 = 48kHz sample rate (Opus standard)
    // -ac 1 = mono (smaller file, good for voice)
    await ff.exec([
      '-i', inputFileName,
      '-c:a', 'libopus',
      '-b:a', '48k',
      '-ar', '48000',
      '-ac', '1',
      '-application', 'voip', // Optimized for voice
      outputFileName
    ]);
    
    // Read output file
    const outputData = await ff.readFile(outputFileName);
    
    // Convert to ArrayBuffer safely for Blob creation
    // FFmpeg returns Uint8Array which may have SharedArrayBuffer in some cases
    let arrayBuffer: ArrayBuffer;
    if (typeof outputData === 'string') {
      const encoder = new TextEncoder();
      arrayBuffer = encoder.encode(outputData).buffer as ArrayBuffer;
    } else {
      // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
      arrayBuffer = new ArrayBuffer(outputData.byteLength);
      new Uint8Array(arrayBuffer).set(outputData);
    }
    
    // Clean up
    await ff.deleteFile(inputFileName);
    await ff.deleteFile(outputFileName);
    
    // Create output blob
    const outputBlob = new Blob([arrayBuffer], { type: 'audio/ogg' });
    
    console.log('[AudioTranscoder] Transcoding complete:', {
      inputSize: audioBlob.size,
      outputSize: outputBlob.size,
      compression: `${Math.round((1 - outputBlob.size / audioBlob.size) * 100)}%`,
    });
    
    return { blob: outputBlob, mimeType: 'audio/ogg' };
    
  } catch (error) {
    console.error('[AudioTranscoder] Transcoding failed:', error);
    
    // Fallback: Return original with warning
    console.warn('[AudioTranscoder] Returning original audio - may fail on WhatsApp');
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
