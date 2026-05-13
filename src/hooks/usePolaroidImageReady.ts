import { useCallback, useEffect, useState } from 'react';

export function usePolaroidImageReady(imageUri?: string | null) {
  const [imageReady, setImageReady] = useState(!imageUri);
  const [showImage, setShowImage] = useState(!!imageUri);

  useEffect(() => {
    setImageReady(!imageUri);
    setShowImage(!!imageUri);
  }, [imageUri]);

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