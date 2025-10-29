
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VideoAsset, AudioAsset, HistoryItem, StreamSource, PanelTab, CreateTab, LibraryTab, TalkingAnimationAsset, OverlayAsset } from './types';
import { useWebcam } from './hooks/useWebcam';
import { generateVideoFromImage, generateSpeechFromText, createAudioUrl } from './services/geminiService';
import { ArrowPathIcon, ClockIcon, FaceSmileIcon, FilmIcon, KeyIcon, MicrophoneIcon, MusicalNoteIcon, PhotoIcon, PlayIcon, SignalIcon, SparklesIcon, StopIcon, VideoCameraIcon } from './components/Icons';

// --- Helper Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// --- Child Components ---

const Header = () => (
    <header className="px-4 py-3 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
            <SignalIcon className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold tracking-wider text-white">OmniStream <span className="text-purple-400">Studio</span></h1>
        </div>
    </header>
);

interface StreamPreviewProps {
    stream: MediaStream | null;
    source: StreamSource;
    currentVideoUrl: string | null;
    currentAudioUrl: string | null;
    activeOverlayUrl: string | null;
    isStreaming: boolean;
}

const StreamPreview: React.FC<StreamPreviewProps> = ({ stream, source, currentVideoUrl, currentAudioUrl, activeOverlayUrl, isStreaming }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        if (source === StreamSource.WEBCAM && stream) {
            videoEl.srcObject = stream;
            videoEl.src = '';
            videoEl.muted = true;
            videoEl.play().catch(e => console.error("Webcam play failed", e));
        } else {
            videoEl.srcObject = null;
            videoEl.src = currentVideoUrl || '';
            videoEl.muted = source !== StreamSource.ANIMATION;
             if (currentVideoUrl) {
                videoEl.play().catch(e => console.error("Media play failed", e));
            }
        }
    }, [stream, source, currentVideoUrl]);
    
    useEffect(() => {
        const videoEl = videoRef.current;
        const audioEl = audioRef.current;
        if (!videoEl || !audioEl || source !== StreamSource.ANIMATION) {
            if (audioEl) {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
            return;
        }

        const handlePlay = () => audioEl.play().catch(e => console.error("Audio sync play failed", e));
        const handlePause = () => audioEl.pause();
        const handleSeek = () => { if(Math.abs(audioEl.currentTime - videoEl.currentTime) > 0.5) audioEl.currentTime = videoEl.currentTime; };

        videoEl.addEventListener('play', handlePlay);
        videoEl.addEventListener('pause', handlePause);
        videoEl.addEventListener('timeupdate', handleSeek);
        
        if (!videoEl.paused) handlePlay();

        return () => {
            videoEl.removeEventListener('play', handlePlay);
            videoEl.removeEventListener('pause', handlePause);
            videoEl.removeEventListener('timeupdate', handleSeek);
            if (audioEl) {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
        };

    }, [source, currentAudioUrl]);

    return (
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl shadow-purple-900/20 border-2 border-gray-700">
            <video 
                ref={videoRef}
                autoPlay 
                loop={source !== StreamSource.WEBCAM}
                controls={source === StreamSource.VIDEO_LIBRARY}
                className="w-full h-full object-cover" 
            />
             {source === StreamSource.ANIMATION && currentAudioUrl && (
                <audio ref={audioRef} src={currentAudioUrl} />
            )}
            {activeOverlayUrl && (
                <img src={activeOverlayUrl} className="absolute top-4 right-4 w-1/4 max-w-[150px] h-auto pointer-events-none transition-opacity duration-300 opacity-90" alt="Stream Overlay" />
            )}
            <div className="absolute top-3 left-3 bg-black/50 px-3 py-1 rounded-md text-sm font-semibold flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span>{isStreaming ? 'ON AIR' : 'OFFLINE'}</span>
            </div>
             {source === StreamSource.WEBCAM && !stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                    <VideoCameraIcon className="w-16 h-16 text-gray-500 mb-4"/>
                    <p className="text-gray-400">Webcam is off</p>
                </div>
            )}
        </div>
    );
};

interface ControlsProps {
    isStreaming: boolean;
    onToggleStreaming: () => void;
    streamSource: StreamSource;
    setStreamSource: (source: StreamSource) => void;
    webcamStatus: string;
    startWebcam: () => void;
    stopWebcam: () => void;
}

const Controls: React.FC<ControlsProps> = ({ isStreaming, onToggleStreaming, streamSource, setStreamSource, webcamStatus, startWebcam, stopWebcam}) => {
    const handleWebcamToggle = () => {
        if (webcamStatus === 'STREAMING') {
            stopWebcam();
        } else {
            startWebcam();
        }
    };

    return (
        <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
                <button onClick={() => setStreamSource(StreamSource.WEBCAM)} className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center space-x-2 transition-all ${streamSource === StreamSource.WEBCAM ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><VideoCameraIcon className="w-5 h-5"/><span>Webcam</span></button>
                <button onClick={() => setStreamSource(StreamSource.VIDEO_LIBRARY)} className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center space-x-2 transition-all ${streamSource === StreamSource.VIDEO_LIBRARY ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><FilmIcon className="w-5 h-5"/><span>Videos</span></button>
                <button onClick={() => setStreamSource(StreamSource.ANIMATION)} className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center space-x-2 transition-all ${streamSource === StreamSource.ANIMATION ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><FaceSmileIcon className="w-5 h-5"/><span>Anims</span></button>
            </div>
             <button onClick={handleWebcamToggle} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center space-x-2 transition-all ${webcamStatus === 'STREAMING' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                 {webcamStatus === 'STREAMING' ? <StopIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                 <span>{webcamStatus === 'STREAMING' ? 'Stop Cam' : 'Start Cam'}</span>
            </button>
            <button onClick={onToggleStreaming} className={`w-full sm:w-auto px-6 py-2 rounded-md font-bold flex items-center justify-center space-x-2 transition-all ${isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'} text-white`}>
                {isStreaming ? <StopIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
                <span>{isStreaming ? 'End Stream' : 'Go Live'}</span>
            </button>
        </div>
    );
}

interface CreatePanelProps {
    onVideoGenerated: (asset: VideoAsset) => void;
    onAudioGenerated: (asset: AudioAsset) => void;
    onAnimationGenerated: (asset: TalkingAnimationAsset) => void;
    setLoading: (loading: boolean, message?: string) => void;
    onApiKeyError: () => void;
}

const CreatePanel: React.FC<CreatePanelProps> = ({ onVideoGenerated, onAudioGenerated, onAnimationGenerated, setLoading, onApiKeyError }) => {
    const [activeTab, setActiveTab] = useState<CreateTab>(CreateTab.ANIMATION);
    // State for all tabs
    const [videoPrompt, setVideoPrompt] = useState('');
    const [ttsText, setTtsText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [animationPrompt, setAnimationPrompt] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const resetImage = () => {
        setImageFile(null);
        setImagePreview(null);
    }
    
    const handleGenerateAnimation = async () => {
        if (!ttsText || !imageFile) {
            alert("Please provide an image and text for the animation.");
            return;
        }
        setLoading(true);
        try {
            const base64Image = await blobToBase64(imageFile);
            setLoading(true, "Generating audio...");
            const speechPromise = generateSpeechFromText(ttsText).then(base64 => createAudioUrl(base64));
            
            const finalAnimPrompt = `Create a short, subtle, 3-second looping animation of this character. ${animationPrompt}`;
            setLoading(true, "Generating video animation...");
            const videoPromise = generateVideoFromImage(finalAnimPrompt, base64Image, imageFile.type, (msg) => setLoading(true, msg), onApiKeyError);

            const [audioUrl, videoUrl] = await Promise.all([speechPromise, videoPromise]);
            
            onAnimationGenerated({ id: `anim-${Date.now()}`, videoUrl, audioUrl, imagePrompt: finalAnimPrompt, ttsText, createdAt: new Date() });
            setTtsText(''); resetImage(); setAnimationPrompt('');
        } catch (error: any) { console.error(error); alert(error.message); } finally { setLoading(false); }
    };

    const handleGenerateVideo = async () => {
        if (!videoPrompt || !imageFile) { alert("Please provide a prompt and an image."); return; }
        setLoading(true, "Preparing to generate video...");
        try {
            const base64Image = await blobToBase64(imageFile);
            const videoUrl = await generateVideoFromImage(videoPrompt, base64Image, imageFile.type, (msg) => setLoading(true, msg), onApiKeyError);
            onVideoGenerated({ id: `vid-${Date.now()}`, url: videoUrl, prompt: videoPrompt, createdAt: new Date() });
            setVideoPrompt(''); resetImage();
        } catch (error: any) { console.error(error); alert(error.message); } finally { setLoading(false); }
    };

    const handleGenerateAudio = async () => {
        if (!ttsText) { alert("Please enter text for speech synthesis."); return; }
        setLoading(true, "Generating audio...");
        try {
            const base64Audio = await generateSpeechFromText(ttsText);
            const audioUrl = await createAudioUrl(base64Audio);
            onAudioGenerated({ id: `aud-${Date.now()}`, url: audioUrl, text: ttsText, createdAt: new Date() });
            setTtsText('');
        } catch (error: any) { console.error(error); alert(error.message); } finally { setLoading(false); }
    };

    const ImageUploader = () => (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Upload Image</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    {imagePreview ? <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-auto rounded-md"/> : <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                    <div className="flex text-sm text-gray-500"><label htmlFor="file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-purple-500 px-1"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*"/></label><p className="pl-1">or drag and drop</p></div>
                    <p className="text-xs text-gray-600">PNG, JPG up to 10MB</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-gray-700">
                <button onClick={() => setActiveTab(CreateTab.ANIMATION)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === CreateTab.ANIMATION ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><FaceSmileIcon className="w-5 h-5"/>Animation</button>
                <button onClick={() => setActiveTab(CreateTab.VIDEO)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === CreateTab.VIDEO ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><VideoCameraIcon className="w-5 h-5"/>Video</button>
                <button onClick={() => setActiveTab(CreateTab.AUDIO)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === CreateTab.AUDIO ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><MicrophoneIcon className="w-5 h-5"/>Audio</button>
            </div>
            <div className="p-4 space-y-4 flex-grow overflow-y-auto">
                {activeTab === CreateTab.ANIMATION && (
                    <div className="space-y-4">
                        <ImageUploader />
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Text to Speak</label><textarea value={ttsText} onChange={e => setTtsText(e.target.value)} rows={4} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Hello, welcome to my stream..."></textarea></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Animation Style (Optional)</label><textarea value={animationPrompt} onChange={e => setAnimationPrompt(e.target.value)} rows={2} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500" placeholder="e.g., gentle head nod, blinking slowly"></textarea></div>
                        <button onClick={handleGenerateAnimation} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-all"><SparklesIcon className="w-5 h-5" /><span>Generate Animation</span></button>
                    </div>
                )}
                {activeTab === CreateTab.VIDEO && (
                    <div className="space-y-4">
                        <ImageUploader />
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Prompt</label><textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} rows={3} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500" placeholder="e.g., A cat wearing sunglasses..."></textarea></div>
                        <button onClick={handleGenerateVideo} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-all"><SparklesIcon className="w-5 h-5" /><span>Generate Video</span></button>
                    </div>
                )}
                {activeTab === CreateTab.AUDIO && (
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Text</label><textarea value={ttsText} onChange={e => setTtsText(e.target.value)} rows={6} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500" placeholder="Enter text..."></textarea></div>
                        <button onClick={handleGenerateAudio} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-all"><MicrophoneIcon className="w-5 h-5" /><span>Generate Audio</span></button>
                    </div>
                )}
            </div>
        </div>
    );
}

interface LibraryPanelProps {
    videoLibrary: VideoAsset[];
    audioLibrary: AudioAsset[];
    animationLibrary: TalkingAnimationAsset[];
    onSelectVideo: (video: VideoAsset) => void;
    onSelectAnimation: (anim: TalkingAnimationAsset) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ videoLibrary, audioLibrary, animationLibrary, onSelectVideo, onSelectAnimation }) => {
    const [activeTab, setActiveTab] = useState<LibraryTab>(LibraryTab.ANIMATIONS);
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-gray-700">
                <button onClick={() => setActiveTab(LibraryTab.ANIMATIONS)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${activeTab === LibraryTab.ANIMATIONS ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}>Anims ({animationLibrary.length})</button>
                <button onClick={() => setActiveTab(LibraryTab.VIDEOS)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${activeTab === LibraryTab.VIDEOS ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}>Videos ({videoLibrary.length})</button>
                <button onClick={() => setActiveTab(LibraryTab.AUDIOS)} className={`flex-1 py-2 px-4 text-sm font-semibold transition-colors ${activeTab === LibraryTab.AUDIOS ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}>Audios ({audioLibrary.length})</button>
            </div>
            <div className="p-4 space-y-3 flex-grow overflow-y-auto">
                 {activeTab === LibraryTab.ANIMATIONS && (
                    animationLibrary.length > 0 ? animationLibrary.map(anim => (
                        <div key={anim.id} className="bg-gray-800 p-3 rounded-lg flex items-center space-x-4">
                            <video src={anim.videoUrl} className="w-20 h-11 object-cover rounded bg-black" />
                            <div className="flex-grow overflow-hidden"><p className="text-sm font-semibold truncate">{anim.ttsText}</p><p className="text-xs text-gray-400">{formatTime(anim.createdAt)}</p></div>
                            <button onClick={() => onSelectAnimation(anim)} className="p-2 bg-purple-600 rounded-full hover:bg-purple-500 transition-colors"><PlayIcon className="w-5 h-5 text-white"/></button>
                        </div>
                    )) : <p className="text-center text-gray-500 mt-4">No animations generated yet.</p>
                )}
                {activeTab === LibraryTab.VIDEOS && (
                    videoLibrary.length > 0 ? videoLibrary.map(video => (
                        <div key={video.id} className="bg-gray-800 p-3 rounded-lg flex items-center space-x-4">
                            <video src={video.url} className="w-20 h-11 object-cover rounded bg-black" />
                            <div className="flex-grow overflow-hidden"><p className="text-sm font-semibold truncate">{video.prompt}</p><p className="text-xs text-gray-400">{formatTime(video.createdAt)}</p></div>
                            <button onClick={() => onSelectVideo(video)} className="p-2 bg-purple-600 rounded-full hover:bg-purple-500 transition-colors"><PlayIcon className="w-5 h-5 text-white"/></button>
                        </div>
                    )) : <p className="text-center text-gray-500 mt-4">No videos generated yet.</p>
                )}
                 {activeTab === LibraryTab.AUDIOS && (
                    audioLibrary.length > 0 ? audioLibrary.map(audio => (
                        <div key={audio.id} className="bg-gray-800 p-3 rounded-lg flex items-center space-x-4">
                            <div className="p-3 bg-gray-700 rounded-lg"><MusicalNoteIcon className="w-5 h-5 text-purple-400"/></div>
                            <div className="flex-grow overflow-hidden"><p className="text-sm font-semibold truncate">{audio.text}</p><audio src={audio.url} controls className="w-full h-8 mt-1"></audio></div>
                        </div>
                    )) : <p className="text-center text-gray-500 mt-4">No audio generated yet.</p>
                )}
            </div>
        </div>
    )
}

interface OverlaysPanelProps {
    overlayLibrary: OverlayAsset[];
    onOverlayUploaded: (file: File) => void;
    onToggleOverlay: (overlay: OverlayAsset) => void;
    activeOverlayUrl: string | null;
}

const OverlaysPanel: React.FC<OverlaysPanelProps> = ({ overlayLibrary, onOverlayUploaded, onToggleOverlay, activeOverlayUrl }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onOverlayUploaded(event.target.files[0]);
            // Reset file input to allow uploading the same file again
            event.target.value = '';
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-700">
                <h3 className="font-semibold text-lg">Overlays</h3>
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif, image/webp" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-all">
                    <PhotoIcon className="w-5 h-5" />
                    <span>Upload Image</span>
                </button>
            </div>
            <div className="p-4 space-y-3 flex-grow overflow-y-auto">
                {overlayLibrary.length > 0 ? overlayLibrary.map(overlay => (
                    <div key={overlay.id} className="bg-gray-800 p-3 rounded-lg flex items-center space-x-4">
                        <img src={overlay.url} alt={overlay.name} className="w-20 h-11 object-contain rounded bg-black/20" />
                        <div className="flex-grow overflow-hidden">
                            <p className="text-sm font-semibold truncate">{overlay.name}</p>
                        </div>
                        <button onClick={() => onToggleOverlay(overlay)} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeOverlayUrl === overlay.url ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                            {activeOverlayUrl === overlay.url ? 'Hide' : 'Show'}
                        </button>
                    </div>
                )) : <p className="text-center text-gray-500 mt-4">No overlays uploaded yet.</p>}
            </div>
        </div>
    )
};


const HistoryPanel: React.FC<{ history: HistoryItem[] }> = ({ history }) => (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-700"><h3 className="font-semibold text-lg">Activity Log</h3></div>
        <div className="p-4 space-y-3 flex-grow overflow-y-auto">
            {history.length > 0 ? [...history].reverse().map(item => (
                <div key={item.id} className="flex items-start space-x-3 text-sm">
                    <div className="p-2 bg-gray-700 rounded-full mt-1">
                        {item.type === 'ANIMATION' && <FaceSmileIcon className="w-4 h-4 text-purple-400" />}
                        {item.type === 'VIDEO' && <FilmIcon className="w-4 h-4 text-purple-400" />}
                        {item.type === 'AUDIO' && <MusicalNoteIcon className="w-4 h-4 text-purple-400" />}
                        {item.type === 'STREAM' && <SignalIcon className="w-4 h-4 text-purple-400" />}
                        {item.type === 'OVERLAY' && <PhotoIcon className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div><p className="text-gray-300">{item.description}</p><p className="text-xs text-gray-500">{formatTime(item.timestamp)}</p></div>
                </div>
            )) : <p className="text-center text-gray-500 mt-4">No activity yet.</p>}
        </div>
    </div>
);

// --- Main App Component ---

const App = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamSource, setStreamSource] = useState<StreamSource>(StreamSource.WEBCAM);
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [activeOverlayUrl, setActiveOverlayUrl] = useState<string | null>(null);

    const [videoLibrary, setVideoLibrary] = useState<VideoAsset[]>([]);
    const [audioLibrary, setAudioLibrary] = useState<AudioAsset[]>([]);
    const [animationLibrary, setAnimationLibrary] = useState<TalkingAnimationAsset[]>([]);
    const [overlayLibrary, setOverlayLibrary] = useState<OverlayAsset[]>([]);

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoadingState] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [activePanelTab, setActivePanelTab] = useState<PanelTab>(PanelTab.CREATE);
    const [hasApiKey, setHasApiKey] = useState(false);

    const { stream, status: webcamStatus, startWebcam, stopWebcam } = useWebcam();
    
    useEffect(() => {
        const checkApiKey = async () => { if (window.aistudio) setHasApiKey(await window.aistudio.hasSelectedApiKey()); };
        checkApiKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio) { await window.aistudio.openSelectKey(); setHasApiKey(true); }
    };
    
    const handleApiKeyError = () => {
        setHasApiKey(false);
        alert("Your API Key seems to be invalid. Please select a valid API key to continue.");
    };

    const addHistoryItem = useCallback((type: HistoryItem['type'], description: string) => {
        setHistory(prev => [...prev, { id: `hist-${Date.now()}`, type, description, timestamp: new Date() }]);
    }, []);

    const handleToggleStreaming = () => setIsStreaming(prev => { addHistoryItem('STREAM', prev ? 'Stream ended.' : 'Stream started.'); return !prev; });
    const setLoading = (isLoading: boolean, message: string = '') => { setLoadingState(isLoading); setLoadingMessage(message); };
    const handleVideoGenerated = (asset: VideoAsset) => { setVideoLibrary(prev => [...prev, asset]); addHistoryItem('VIDEO', `Generated video: "${asset.prompt}"`); };
    const handleAudioGenerated = (asset: AudioAsset) => { setAudioLibrary(prev => [...prev, asset]); addHistoryItem('AUDIO', `Generated audio: "${asset.text.substring(0, 30)}..."`); };
    const handleAnimationGenerated = (asset: TalkingAnimationAsset) => { setAnimationLibrary(prev => [...prev, asset]); addHistoryItem('ANIMATION', `Generated animation: "${asset.ttsText.substring(0, 30)}..."`); };

    const handleSelectVideo = (video: VideoAsset) => {
        setCurrentVideoUrl(video.url);
        setCurrentAudioUrl(null);
        setStreamSource(StreamSource.VIDEO_LIBRARY);
        addHistoryItem('VIDEO', `Set stream to video: "${video.prompt}"`);
    };
    
    const handleSelectAnimation = (anim: TalkingAnimationAsset) => {
        setCurrentVideoUrl(anim.videoUrl);
        setCurrentAudioUrl(anim.audioUrl);
        setStreamSource(StreamSource.ANIMATION);
        addHistoryItem('ANIMATION', `Set stream to animation: "${anim.ttsText.substring(0, 30)}..."`);
    };

    const handleOverlayUploaded = (file: File) => {
        const newOverlay: OverlayAsset = {
            id: `overlay-${Date.now()}`,
            name: file.name,
            url: URL.createObjectURL(file),
        };
        setOverlayLibrary(prev => [...prev, newOverlay]);
        addHistoryItem('OVERLAY', `Uploaded overlay: "${file.name}"`);
    };

    const handleToggleOverlay = (overlay: OverlayAsset) => {
        setActiveOverlayUrl(prev => {
            const newUrl = prev === overlay.url ? null : overlay.url;
            addHistoryItem('OVERLAY', `${newUrl ? 'Showing' : 'Hiding'} overlay: "${overlay.name}"`);
            return newUrl;
        });
    };

    return (
        <div className="h-screen w-screen bg-gray-900 text-white flex flex-col font-sans">
            {!hasApiKey && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-gray-800 p-8 rounded-lg text-center max-w-md"><KeyIcon className="w-12 h-12 mx-auto text-purple-400 mb-4" /><h2 className="text-2xl font-bold mb-2">API Key Required</h2><p className="text-gray-400 mb-6">Video generation requires an API key. Please select one to proceed.</p><p className="text-xs text-gray-500 mb-6">For billing info, visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-400">ai.google.dev/gemini-api/docs/billing</a>.</p><button onClick={handleSelectKey} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center space-x-2 transition-all"><KeyIcon className="w-5 h-5" /><span>Select API Key</span></button></div></div>
            )}
            {loading && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"><div className="text-center"><ArrowPathIcon className="w-12 h-12 text-purple-500 animate-spin mx-auto" /><p className="mt-4 text-lg font-semibold">{loadingMessage}</p></div></div>
            )}
            <Header />
            <main className="flex-grow flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
                <div className="flex-grow flex flex-col gap-4 overflow-y-auto lg:pr-2">
                    <StreamPreview stream={stream} source={streamSource} currentVideoUrl={currentVideoUrl} currentAudioUrl={currentAudioUrl} activeOverlayUrl={activeOverlayUrl} isStreaming={isStreaming} />
                    <Controls isStreaming={isStreaming} onToggleStreaming={handleToggleStreaming} streamSource={streamSource} setStreamSource={setStreamSource} webcamStatus={webcamStatus} startWebcam={startWebcam} stopWebcam={stopWebcam} />
                </div>
                <aside className="w-full lg:w-96 lg:flex-shrink-0 flex flex-col bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
                     <div className="flex border-b border-gray-700">
                        <button onClick={() => setActivePanelTab(PanelTab.CREATE)} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activePanelTab === PanelTab.CREATE ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><SparklesIcon className="w-5 h-5"/>AI Tools</button>
                        <button onClick={() => setActivePanelTab(PanelTab.LIBRARY)} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activePanelTab === PanelTab.LIBRARY ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><FilmIcon className="w-5 h-5" />Library</button>
                        <button onClick={() => setActivePanelTab(PanelTab.OVERLAYS)} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activePanelTab === PanelTab.OVERLAYS ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><PhotoIcon className="w-5 h-5"/>Overlays</button>
                        <button onClick={() => setActivePanelTab(PanelTab.HISTORY)} className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activePanelTab === PanelTab.HISTORY ? 'bg-gray-700 text-purple-400' : 'text-gray-400 hover:bg-gray-800'}`}><ClockIcon className="w-5 h-5"/>History</button>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        {activePanelTab === PanelTab.CREATE && <CreatePanel onVideoGenerated={handleVideoGenerated} onAudioGenerated={handleAudioGenerated} onAnimationGenerated={handleAnimationGenerated} setLoading={setLoading} onApiKeyError={handleApiKeyError} />}
                        {activePanelTab === PanelTab.LIBRARY && <LibraryPanel videoLibrary={videoLibrary} audioLibrary={audioLibrary} animationLibrary={animationLibrary} onSelectVideo={handleSelectVideo} onSelectAnimation={handleSelectAnimation} />}
                        {activePanelTab === PanelTab.OVERLAYS && <OverlaysPanel overlayLibrary={overlayLibrary} onOverlayUploaded={handleOverlayUploaded} onToggleOverlay={handleToggleOverlay} activeOverlayUrl={activeOverlayUrl} />}
                        {activePanelTab === PanelTab.HISTORY && <HistoryPanel history={history} />}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default App;
