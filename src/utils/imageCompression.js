import Compressor from 'compressorjs';

export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      convertSize: 500000, // 500KB
      success: resolve,
      error: reject,
      ...options,
    });
  });
};

export const compressImages = async (files) => {
  const compressedFiles = [];
  for (const file of files) {
    try {
      const compressed = await compressImage(file);
      compressedFiles.push(compressed);
    } catch (error) {
      console.error('Error compressing image:', error);
      compressedFiles.push(file);
    }
  }
  return compressedFiles;
};