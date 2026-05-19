import { useCallback, useEffect, useState } from 'react';

export function usePolaroidImageReady(imageUri?: string | null, enabled: boolean = true) {
  const [imageReady, setImageReady] = useState(!imageUri);
  const [showImage, setShowImage] = useState(!!imageUri && enabled);

  useEffect(() => {
    if (!imageUri) {
      setImageReady(true);
      setShowImage(false);
      return;
    }

    if (!enabled) {
      setImageReady(false);
      setShowImage(false);
      return;
    }

    setImageReady(false);
    setShowImage(true);
  }, [enabled, imageUri]);

  const handleImageLoad = useCallback(() => {
    setImageReady(true);
  }, []);

  const handleImageError = useCallback(() => {
    setShowImage(false);
    setImageReady(true);
  }, []);

  return {
    imageReady,
    showImage,
    handleImageLoad,
    handleImageError,
  };
}