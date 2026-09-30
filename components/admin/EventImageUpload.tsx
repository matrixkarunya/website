// components/admin/EventImageUpload.tsx
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';

interface EventImageUploadProps {
  onImageSelect: (file: File) => void;
  onImageRemove?: () => void;
  imagePreview?: string;
  label?: string;
  required?: boolean;
}

export default function EventImageUpload({
  onImageSelect,
  onImageRemove,
  imagePreview,
  label = 'Event Image',
  required = true,
}: EventImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const validate = (file: File): boolean => {
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP)');
      return false;
    }

    const maxSize = 8 * 1024 * 1024; // 8MB
    if (file.size > maxSize) {
      setError(`Image should be less than 8MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return false;
    }

    return true;
  };

  const handleFile = (file?: File) => {
    if (file && validate(file)) onImageSelect(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError('');
    onImageRemove?.();
  };

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
        <ImageIcon className="w-4 h-4 text-white/60" />
        {label} {required && '*'}
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`border-2 border-dashed rounded-xl p-4 transition-all backdrop-blur-xl ${
          isDragging
            ? 'border-blue-500/50 bg-blue-500/10'
            : error
            ? 'border-red-500/50 bg-red-500/10'
            : imagePreview
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-white/20 bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
        />

        {/* 16:10 preview – matches the card on the public Events page */}
        <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-white/5 border border-white/10 group">
          {imagePreview ? (
            <>
              <Image
                src={imagePreview}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-3 right-3 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg opacity-0 group-hover:opacity-100"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            >
              <ImageIcon className="w-10 h-10" />
              <span className="text-sm">
                {isDragging ? 'Drop image here...' : 'Click or drag an image here'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="text-xs text-white/50">
            PNG, JPG, WEBP • Max 8MB • Recommended: 1600×1000px (16:10)
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all font-medium shadow-lg hover:shadow-blue-500/25 flex-shrink-0"
          >
            <Upload className="w-4 h-4" />
            {imagePreview ? 'Change' : 'Upload'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 backdrop-blur-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {imagePreview && !error && (
        <div className="mt-3 flex items-center gap-3 text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-xl p-3 backdrop-blur-xl">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">Image ready</span>
        </div>
      )}
    </div>
  );
}