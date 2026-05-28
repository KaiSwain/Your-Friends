import { Alert } from 'react-native';

interface PhotoSourceSheetOptions {
  cameraLabel?: string;
  galleryLabel?: string;
  galleryLocked?: boolean;
  onCamera: () => void;
  onGallery: () => void;
  title?: string;
}

export function showPhotoSourceSheet({ cameraLabel = 'Take Photo', galleryLabel, galleryLocked = false, onCamera, onGallery, title = 'Add Photo' }: PhotoSourceSheetOptions) {
  const resolvedGalleryLabel = galleryLabel ?? (galleryLocked ? 'Choose from Gallery (Premium)' : 'Choose from Gallery');

  Alert.alert(title, 'Choose a photo source.', [
    { text: cameraLabel, onPress: onCamera },
    { text: resolvedGalleryLabel, onPress: onGallery },
    { text: 'Cancel', style: 'cancel' },
  ]);
}