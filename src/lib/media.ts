import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

export async function pickImageFile(): Promise<File> {
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (!photo.webPath) {
        throw new Error('Image selection failed: no webPath returned');
      }

      const response = await fetch(photo.webPath);
      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Selected image is empty (0 bytes). Please select a valid photo.');
      }

      // Convert Blob to File for consistency
      const ext = photo.format || 'jpeg';
      const fileName = `photo_${Date.now()}.${ext}`;
      const fileType = blob.type || `image/${ext}`;

      return new File([blob], fileName, { type: fileType });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : '';

      if (
        message === 'User cancelled photos app' ||
        message.includes('cancelled') ||
        message.includes('User cancelled')
      ) {
        throw new Error('Picker cancelled'); // Specific string we can check for
      }
      logger.error('media_pick_photo_failed', {
        message: err instanceof Error ? err.message : err,
      });
      throw new Error(message || 'Failed to open photo picker');
    }
  } else {
    // For web, use a standard hidden input file dialog dynamically
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/*';

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          if (file.size === 0) {
            reject(new Error('Selected image is empty (0 bytes). Please select a valid photo.'));
            return;
          }
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      };

      // oncancel doesn't always fire reliably in older browsers but good to have
      input.oncancel = () => {
        reject(new Error('Picker cancelled'));
      };

      input.click();
    });
  }
}
