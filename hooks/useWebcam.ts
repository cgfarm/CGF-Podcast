
import { useState, useEffect, useRef } from 'react';

type WebcamStatus = 'IDLE' | 'REQUESTING' | 'STREAMING' | 'ERROR';

export const useWebcam = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startWebcam = async () => {
    setStatus('REQUESTING');
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus('STREAMING');
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Could not access webcam. Please check permissions.");
      setStatus('ERROR');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
      setStatus('IDLE');
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { stream, status, error, startWebcam, stopWebcam };
};
