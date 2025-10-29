
// FIX: Removed the 'aistudio' property from the Window interface to resolve a conflict with another global declaration.
// The TypeScript compiler indicated a type mismatch for this property, suggesting it's defined elsewhere.
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export interface VideoAsset {
  id: string;
  url: string;
  prompt: string;
  createdAt: Date;
}

export interface AudioAsset {
  id:string;
  url: string;
  text: string;
  createdAt: Date;
}

export interface TalkingAnimationAsset {
  id: string;
  videoUrl: string;
  audioUrl: string;
  imagePrompt: string;
  ttsText: string;
  createdAt: Date;
}

export interface OverlayAsset {
  id: string;
  url: string;
  name: string;
}


export interface HistoryItem {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'STREAM' | 'ANIMATION' | 'OVERLAY';
  description: string;
  timestamp: Date;
}

export enum StreamSource {
  WEBCAM = 'WEBCAM',
  VIDEO_LIBRARY = 'VIDEO_LIBRARY',
  ANIMATION = 'ANIMATION',
}

export enum PanelTab {
  CREATE = 'CREATE',
  LIBRARY = 'LIBRARY',
  OVERLAYS = 'OVERLAYS',
  HISTORY = 'HISTORY',
}

export enum CreateTab {
  ANIMATION = 'ANIMATION',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
}

export enum LibraryTab {
  VIDEOS = 'VIDEOS',
  AUDIOS = 'AUDIOS',
  ANIMATIONS = 'ANIMATIONS',
}