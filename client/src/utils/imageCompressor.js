/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Resizes the image to a maximum dimension (default 1600px) and converts to JPEG.
 * 
 * @param {File} file - Image file from file input
 * @param {number} maxDimension - Maximum width or height in pixels
 * @param {number} quality - JPEG compression quality (0.0 - 1.0)
 * @returns {Promise<string>} Base64 Data URL of compressed JPEG image
 */
export function compressImage(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file provided.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into element.'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2D canvas context.'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas content to base64 Data URL with JPEG compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
