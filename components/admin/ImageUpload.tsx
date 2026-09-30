// components/admin/ImageUpload.tsx
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  imagePreview?: string;
}

export default function ImageUpload({
  onImageSelect,
  imagePreview,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const validateAndProcessFile = (file: File) => {
    setError('');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP)');
      return false;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError(`Image size should be less than 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return false;
    }

    // Validate file dimensions (optional but recommended)
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // Optional: warn if image is too small
      if (img.width < 200 || img.height < 200) {
        setError('Image should be at least 200x200px for best quality');
        return;
      }
    };
    img.src = objectUrl;

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateAndProcessFile(file)) {
      onImageSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && validateAndProcessFile(file)) {
      onImageSelect(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError('');
    // You might want to call a callback here to reset the parent component's state
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
        <ImageIcon className="w-4 h-4 text-white/60" />
        Profile Image *
      </label>
      
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 transition-all backdrop-blur-xl ${
          isDragging
            ? 'border-blue-500/50 bg-blue-500/10'
            : error
            ? 'border-red-500/50 bg-red-500/10'
            : imagePreview
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-white/20 bg-white/5'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Image Preview */}
          <div className="flex-shrink-0">
            {imagePreview ? (
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg group">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-xl bg-white/5 flex items-center justify-center border-2 border-dashed border-white/20">
                <ImageIcon className="w-12 h-12 text-white/40" />
              </div>
            )}
          </div>

          {/* Upload Instructions */}
          <div className="flex-1 text-center md:text-left">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium shadow-lg hover:shadow-blue-500/25"
            >
              <Upload className="w-4 h-4" />
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </button>

            <p className="text-xs text-white/60 mt-3 leading-relaxed">
              {isDragging ? (
                <span className="text-blue-400 font-medium flex items-center justify-center md:justify-start gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  Drop image here...
                </span>
              ) : (
                <>
                  <span className="font-medium text-white/80">Click to upload</span> or drag and drop
                  <br />
                  <span className="text-white/50">PNG, JPG, WEBP • Max 5MB • Recommended: 400x400px</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 flex items-start gap-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 backdrop-blur-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Indicator */}
      {imagePreview && !error && (
        <div className="mt-3 flex items-center gap-3 text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-xl p-3 backdrop-blur-xl">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">Image ready to upload</span>
        </div>
      )}
    </div>
  );
}
