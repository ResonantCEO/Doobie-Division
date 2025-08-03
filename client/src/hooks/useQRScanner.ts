
import { useRef, useCallback, useState } from 'react';

interface QRScannerOptions {
  onSuccess: (data: string) => void;
  onError: (error: Error) => void;
}

export const useQRScanner = ({ onSuccess, onError }: QRScannerOptions) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const [isScanning, setIsScanning] = useState(false);

  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
        
        const detectQRCode = () => {
          if (!videoRef.current || !canvasRef.current || !isScanning) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // Import jsQR dynamically to avoid build issues
            import('jsqr').then(({ default: jsQR }) => {
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });

              if (code) {
                onSuccess(code.data);
              }
            }).catch((error) => {
              console.warn('jsQR not available:', error);
            });
          }

          if (isScanning) {
            animationFrameRef.current = requestAnimationFrame(detectQRCode);
          }
        };
        
        videoRef.current.onloadedmetadata = () => {
          detectQRCode();
        };
      }
    } catch (error) {
      onError(new Error('Unable to access camera. Please allow camera permissions.'));
    }
  }, [onSuccess, onError, isScanning]);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
  }, []);

  const simulateScan = useCallback((qrData: string) => {
    // This simulates a successful QR code scan
    // Useful for testing without actual QR codes
    onSuccess(qrData);
  }, [onSuccess]);

  return {
    videoRef,
    canvasRef,
    startScanning,
    stopScanning,
    simulateScan,
    isScanning
  };
};
