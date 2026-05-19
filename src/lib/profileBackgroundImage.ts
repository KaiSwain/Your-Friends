import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

export async function cropProfileBackgroundAsset(asset: ImagePickerAsset) {
  const targetAspect = 9 / 16;
  const sourceWidth = asset.width;
  const sourceHeight = asset.height;
  const sourceAspect = sourceWidth / sourceHeight;
  const cropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
  const cropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
  const originX = Math.max(0, (sourceWidth - cropWidth) / 2);
  const originY = Math.max(0, (sourceHeight - cropHeight) / 2);

  const result = await manipulateAsync(
    asset.uri,
    [
      {
        crop: {
          originX,
          originY,
          width: cropWidth,
          height: cropHeight,
        },
      },
      { resize: { width: 1080 } },
    ],
    { compress: 0.88, format: SaveFormat.JPEG },
  );

  return result.uri;
}
