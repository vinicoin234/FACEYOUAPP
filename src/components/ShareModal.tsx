import React, { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamerName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  streamerName,
}) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://faceyou.live/live';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#ff0050]/20 border border-[#ff0050]/40 flex items-center justify-center text-[#ff0050]">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Share Stream
            </h2>
            <p className="text-xs text-neutral-400">
              Invite friends to watch {streamerName}
            </p>
          </div>
        </div>

        {/* Link copy box */}
        <div className="bg-neutral-950 border border-neutral-700 rounded-2xl p-2.5 flex items-center justify-between gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="bg-transparent text-xs text-neutral-300 w-full focus:outline-none truncate font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-neutral-400">
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Watch ${streamerName} live on FaceYou! ${shareUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl flex flex-col items-center gap-1.5 text-emerald-400 transition-colors"
          >
            <i className="fa-brands fa-whatsapp text-2xl" />
            <span>WhatsApp</span>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Watching ${streamerName} on FaceYou Live! 🎥`)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl flex flex-col items-center gap-1.5 text-sky-400 transition-colors"
          >
            <i className="fa-brands fa-x-twitter text-2xl" />
            <span>Twitter</span>
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Watch ${streamerName} on FaceYou`)}`}
            target="_blank"
            rel="noreferrer"
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl flex flex-col items-center gap-1.5 text-cyan-400 transition-colors"
          >
            <i className="fa-brands fa-telegram text-2xl" />
            <span>Telegram</span>
          </a>
          <button
            onClick={handleCopy}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl flex flex-col items-center gap-1.5 text-neutral-300 transition-colors"
          >
            <i className="fa-solid fa-link text-2xl" />
            <span>Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
