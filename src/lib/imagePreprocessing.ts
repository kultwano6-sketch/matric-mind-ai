// Image Preprocessing utilities for better OCR
// Part 3: Snap & Solve Robustness - Image preprocessing before OCR

export interface PreprocessOptions {
  targetWidth?: number;
  contrast?: number;
  brightness?: number;
  denoise?: boolean;
  sharpen?: boolean;
  deskew?: boolean;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  targetWidth: 1200,
  contrast: 1.2,
  brightness: 1.0,
  denoise: true,
  sharpen: true,
  deskew: false,
};

// Detect if image is too dark or too light
export function detectImageQuality(
  imageData: ImageData
): { quality: 'good' | 'dark' | 'light' | 'blurry'; score: number } {
  const data = imageData.data;
  let darkPixels = 0;
  let lightPixels = 0;
  let totalBrightness = 0;
  let edgePixels = 0;

  const width = imageData.width;
  const height = imageData.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += luminance;

      // Count dark/light pixels
      if (luminance < 30) darkPixels++;
      if (luminance > 225) lightPixels++;

      // Simple edge detection for blur
      if (x < width - 1) {
        const nextI = (y * width + x + 1) * 4;
        const nextLum =
          0.299 * data[nextI] +
          0.587 * data[nextI + 1] +
          0.114 * data[nextI + 2];
        if (Math.abs(luminance - nextLum) > 20) {
          edgePixels++;
        }
      }
    }
  }

  const totalPixels = width * height;
  const avgBrightness = totalBrightness / totalPixels;
  const edgeRatio = edgePixels / totalPixels;

  // Score based on analysis
  let score = 70; // Base score
  let quality: 'good' | 'dark' | 'light' | 'blurry' = 'good';

  // Adjust for darkness
  if (avgBrightness < 50) {
    score -= 20;
    quality = 'dark';
  }

  // Adjust for brightness
  if (avgBrightness > 200) {
    score -= 20;
    quality = 'light';
  }

  // Adjust for blur (low edge ratio = blurry)
  if (edgeRatio < 0.1) {
    score -= 15;
    quality = 'blurry';
  }

  // Good quality bonuses
  if (avgBrightness > 80 && avgBrightness < 180) score += 10;
  if (edgeRatio > 0.15) score += 10;

  return {
    quality,
    score: Math.max(0, Math.min(100, score)),
  };
}

// Preprocess image using canvas
export async function preprocessImage(
  dataUrl: string,
  options: PreprocessOptions = DEFAULT_OPTIONS
): Promise<{ result: string; quality: ReturnType<typeof detectImageQuality> }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      let width = img.width;
      let height = img.height;

      // Resize if needed
      const targetWidth = options.targetWidth || DEFAULT_OPTIONS.targetWidth!;
      if (width > targetWidth) {
        height = (height * targetWidth) / width;
        width = targetWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw original
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Apply preprocessing
      const contrast = options.contrast || DEFAULT_OPTIONS.contrast!;
      const brightness = options.brightness || DEFAULT_OPTIONS.brightness!;
      const denoise = options.denoise ?? DEFAULT_OPTIONS.denoise!;
      const sharpen = options.sharpen ?? DEFAULT_OPTIONS.sharpen!;

      // Process pixel data
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Convert to luminance
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Apply contrast
        gray = ((gray - 128) * contrast) + 128;

        // Apply brightness
        gray = gray * brightness;

        // Clamp values
        r = Math.max(0, Math.min(255, gray));
        g = Math.max(0, Math.min(255, gray));
        b = Math.max(0, Math.min(255, gray));

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }

      // Apply simple denoise (median filter) if enabled
      if (denoise) {
        applyMedianFilter(imageData);
      }

      // Apply sharpen if enabled
      if (sharpen) {
        applySharpen(imageData);
      }

      // Put processed data back
      ctx.putImageData(imageData, 0, 0);

      // Detect quality
      const quality = detectImageQuality(imageData);

      resolve({
        result: canvas.toDataURL('image/jpeg', 0.85),
        quality,
      });
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

// Simple 3x3 median filter for noise reduction
function applyMedianFilter(imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        // Get 3x3 neighborhood
        const neighbors = [
          data[((y - 1) * width + (x - 1)) * 4 + c],
          data[((y - 1) * width + x) * 4 + c],
          data[((y - 1) * width + (x + 1)) * 4 + c],
          data[(y * width + (x - 1)) * 4 + c],
          data[(y * width + x) * 4 + c],
          data[(y * width + (x + 1)) * 4 + c],
          data[((y + 1) * width + (x - 1)) * 4 + c],
          data[((y + 1) * width + x) * 4 + c],
          data[((y + 1) * width + (x + 1)) * 4 + c],
        ];

        // Sort and get median
        neighbors.sort((a, b) => a - b);
        const median = neighbors[4];

        output[y * width * 4 + x * 4 + c] = median;
      }
      // Copy alpha
      output[y * width * 4 + x * 4 + 3] = data[y * width * 4 + x * 4 + 3];
    }
  }

  // Copy to original
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i] || data[i];
  }
}

// Unsharp mask for sharpening
function applySharpen(imageData: ImageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data.length);

  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel =
              data[((y + ky) * width + (x + kx)) * 4 + c] * kernel[ki];
            sum += pixel;
            ki++;
          }
        }

        output[y * width * 4 + x * 4 + c] = Math.max(0, Math.min(255, sum));
      }
      output[y * width * 4 + x * 4 + 3] = data[y * width * 4 + x * 4 + 3];
    }
  }

  for (let i = 0; i < data.length; i++) {
    if (output[i]) data[i] = output[i];
  }
}

// Quality warning messages
export function getQualityWarning(
  quality: ReturnType<typeof detectImageQuality>
): string | null {
  switch (quality.quality) {
    case 'dark':
      return '⚠️ The image appears too dark. For better results, try increasing the brightness.';
    case 'light':
      return '⚠️ The image appears too bright/washed out. Try in lower light conditions.';
    case 'blurry':
      return '⚠️ The image may be blurry. Hold steady and try again.';
    default:
      if (quality.score < 50) {
        return '⚠️ Image quality is low. For better results, ensure good lighting and a steady hand.';
      }
      return null;
  }
}