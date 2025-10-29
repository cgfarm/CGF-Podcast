import { GoogleGenAI, Modality, VideosOperation } from "@google/genai";

// --- Audio Helper Functions ---
const decode = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / 1; // Mono channel
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

export const createAudioUrl = async (base64Audio: string): Promise<string> => {
    const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    const decodedBytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext);

    // Convert AudioBuffer to a WAV Blob
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    const buffer = new ArrayBuffer(44 + audioBuffer.length * 2);
    const view = new DataView(buffer);
    const channels = audioBuffer.getChannelData(0);
    let offset = 0;
    
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + channels.length * 2, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint32(offset, outputAudioContext.sampleRate, true); offset += 4;
    view.setUint32(offset, outputAudioContext.sampleRate * 2, true); offset += 4;
    view.setUint16(offset, 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, channels.length * 2, true); offset += 4;

    for (let i = 0; i < channels.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, channels[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

// --- API Service Functions ---

export const generateVideoFromImage = async (
  prompt: string,
  base64Image: string,
  imageMimeType: string,
  setLoadingMessage: (message: string) => void,
  onApiKeyError: () => void,
): Promise<string> => {
  try {
    setLoadingMessage("Initializing video generation service...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    setLoadingMessage("Generating video... this may take a few minutes.  visionary ideas need time.");
    let operation: VideosOperation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: base64Image,
        mimeType: imageMimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    setLoadingMessage("Video is processing on our servers. Checking status...");
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      setLoadingMessage("Still processing... Great things are worth the wait.");
      try {
        operation = await ai.operations.getVideosOperation({ operation: operation });
      } catch (e: any) {
        if (e.message?.includes("Requested entity was not found.")) {
            onApiKeyError();
            throw new Error("API key invalid or not found. Please select a valid key.");
        }
        throw e;
      }
    }
    
    setLoadingMessage("Finalizing video and preparing for download...");
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error("Video generation failed: no download link found.");
    }
    
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);
  } catch(e: any) {
      if (e.message?.includes("API key invalid or not found.")) {
          throw e;
      }
      console.error(e);
      throw new Error("Failed to generate video. Please check the console for details.");
  }
};

export const generateSpeechFromText = async (text: string): Promise<string> => {
  if (!text) throw new Error("Text cannot be empty.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say with a clear, engaging podcast voice: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio. No data received.");
  }

  return base64Audio;
};
