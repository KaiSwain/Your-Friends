import { Alert } from 'react-native';

interface PhotoSourceSheetOptions {
  galleryLocked?: boolean;
  onCamera: () => void;
  onGallery: () => void;
  title?: string;
}

export interface PhotoSourceSheetRequest {
  galleryLabel: string;
  onCamera: () => void;
  onGallery: () => void;
  title: string;
}

type PhotoSourceSheetListener = (request: PhotoSourceSheetRequest | null) => void;

let activeListener: PhotoSourceSheetListener | null = null;

export function subscribePhotoSourceSheet(listener: PhotoSourceSheetListener) {
  activeListener = listener;
  return () => {
    if (activeListener === listener) activeListener = null;
  };
}

export function showPhotoSourceSheet({ galleryLocked = false, onCamera, onGallery, title = 'Add Photo' }: PhotoSourceSheetOptions) {
  const galleryLabel = galleryLocked ? 'Choose from Gallery (Premium)' : 'Choose from Gallery';

  if (activeListener) {
    activeListener({ galleryLabel, onCamera, onGallery, title });
    return;
  }

  Alert.alert(title, 'Choose a photo source.', [
    { text: 'Take Photo', onPress: onCamera },
    { text: galleryLabel, onPress: onGallery },
    { text: 'Cancel', style: 'cancel' },
  ]);
}