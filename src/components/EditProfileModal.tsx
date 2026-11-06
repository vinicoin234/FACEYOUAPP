import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Trash2, User as UserIcon, AtSign } from 'lucide-react';
import { User } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateUser: (updated: Partial<User>) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState(user.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle local image file upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name: name.trim(),
      handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`,
      bio: bio.trim(),
      avatar,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-black text-white tracking-tight mb-4">
          Edit Your Profile
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Real Photo Upload from Device */}
          <div className="flex flex-col items-center">
            <div className="relative group mb-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#ff0050] to-[#00f2fe] shadow-xl cursor-pointer hover:scale-105 transition-transform"
              >
                <img
                  src={avatar}
                  alt={name}
                  className="w-full h-full rounded-full object-cover border-2 border-black"
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#ff0050] text-white shadow-md border-2 border-black hover:scale-110 transition-transform"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 mt-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Photo</span>
            </button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-300 block mb-1">
              Display Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff0050]"
                required
              />
              <UserIcon className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-300 block mb-1">
              Username Handle
            </label>
            <div className="relative">
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff0050]"
                required
              />
              <AtSign className="w-4 h-4 text-neutral-500 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-300 block mb-1">
              Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell fans about yourself..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#ff0050]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Save Profile</span>
          </button>
        </form>
      </div>
    </div>
  );
};
