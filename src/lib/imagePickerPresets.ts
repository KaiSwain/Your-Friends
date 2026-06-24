import type * as ImagePicker from 'expo-image-picker';

export const avatarImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
} satisfies ImagePicker.ImagePickerOptions;

export const memoryImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
  exif: true,
} satisfies ImagePicker.ImagePickerOptions;

export const memoryMediaPickerOptions = {
  mediaTypes: ['images', 'videos'],
  quality: 0.9,
  videoMaxDuration: 30,
  exif: true,
} satisfies ImagePicker.ImagePickerOptions;

export const profileBackgroundImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [9, 16],
  quality: 0.9,
} satisfies ImagePicker.ImagePickerOptions;

export const privateNoteImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
} satisfies ImagePicker.ImagePickerOptions;
