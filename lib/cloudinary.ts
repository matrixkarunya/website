// lib/cloudinary.ts

// Cloudinary configuration for client-side
export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
};

// Upload image to Cloudinary from client
export const uploadToCloudinary = async (file: File): Promise<{
  url: string;
  publicId: string;
}> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset!);
  formData.append('folder', 'team-images');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Get optimized image URL with transformations
export const getOptimizedImageUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
): string => {
  const { width = 400, height = 400, quality = 'auto', format = 'auto' } = options;
  
  // Extract the public ID from the Cloudinary URL
  const urlParts = url.split('/upload/');
  if (urlParts.length !== 2) return url;
  
  const [baseUrl, assetPath] = urlParts;
  
  // Add optimization transformations
  const transformations = `w_${width},h_${height},c_fill,q_${quality},f_${format}`;
  
  return `${baseUrl}/upload/${transformations}/${assetPath}`;
};

// Helper to get thumbnail URL (for cards)
export const getThumbnailUrl = (url: string): string => {
  return getOptimizedImageUrl(url, {
    width: 400,
    height: 400,
    quality: 'auto',
    format: 'auto',
  });
};

// Helper to get full size URL (for modals)
export const getFullSizeUrl = (url: string): string => {
  return getOptimizedImageUrl(url, {
    width: 800,
    height: 800,
    quality: 'auto',
    format: 'auto',
  });
};
