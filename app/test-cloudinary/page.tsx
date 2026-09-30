// app/test-cloudinary/page.tsx
'use client';

import { useState } from 'react';
import { uploadToCloudinary } from '@/lib/cloudinary';

export default function TestCloudinary() {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [publicId, setPublicId] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    
    try {
      const { url, publicId } = await uploadToCloudinary(file);
      setImageUrl(url);
      setPublicId(publicId);
      alert('Upload successful!');
    } catch (error) {
      console.error('Upload error:', error);
      setError('Upload failed! Check console for details.');
      alert('Upload failed!');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Test Cloudinary Upload</h1>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select an image to upload:
          </label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleUpload} 
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {uploading && (
          <div className="mb-4 p-4 bg-blue-50 rounded-md">
            <p className="text-blue-700">Uploading image...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {imageUrl && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Upload Successful! ✅</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1"><strong>Image URL:</strong></p>
              <p className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">{imageUrl}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1"><strong>Public ID:</strong></p>
              <p className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">{publicId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2"><strong>Preview:</strong></p>
              <img 
                src={imageUrl} 
                alt="Uploaded" 
                className="w-64 h-64 object-cover rounded-lg border-2 border-gray-200" 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
