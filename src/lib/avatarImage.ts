import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

export async function cropAvatarImage(uri: string): Promise<string> {
  const { width, height } = await getImageSize(uri);
  const side = Math.min(width, height);
  const originX = Math.max(0, (width - side) / 2);
  const originY = Math.max(0, (height - side) / 2);
  const result = await manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 0.9, format: SaveFormat.JPEG },
  );
  return result.uri;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}
