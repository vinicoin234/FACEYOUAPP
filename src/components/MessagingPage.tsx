import React, { useState, useRef, useEffect } from 'react';
import { useCall } from './CallProvider';
import { sendCoinsChat, sendTextMessage, sendVoiceMessage, startConversation, findUserByHandle, toDirectMessage, mergeMessage } from '../lib/chat';
import {
  Mic,
  Square,
  Send,
  Play,
  Pause,
  Trash2,
  Search,
  Plus,
  Phone,
  Video as VideoCallIcon,
  Smile,
  MoreVertical,
  Check,
  CheckCheck,
  Radio,
  UserCheck,
  Volume2,
  Coins
} from 'lucide-react';
import { User, Conversation, DirectMessage, CoinEarningRecord } from '../types';
import { SendCoinModal } from './SendCoinModal';

interface MessagingPageProps {
  currentUser: User;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onUpdateUser: (updated: Partial<User>) => void;
  onRecordCoinEarning: (record: CoinEarningRecord) => void;
  onOpenRecharge: () => void;
}

export const MessagingPage: React.FC<MessagingPageProps> = ({
  currentUser,
  conversations,
  setConversations,
  onUpdateUser,
  onRecordCoinEarning,
  onOpenRecharge,
}) => {
  const [activeConvId, setActiveConvId] = useState<string>(
    conversations[0]?.id || ''
  );
  const [showSendCoinModal, setShowSendCoinModal] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [newChatName, setNewChatName] = useState<string>('');
  const [newChatHandle, setNewChatHandle] = useState<string>('');

  // Audio Voice Note Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Playback State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId);
  const call = useCall();

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Handle Voice Note Audio Playback
  const togglePlayAudio = (message: DirectMessage) => {
    if (!message.audioUrl) return;

    if (playingMessageId === message.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingMessageId(null);
      }
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(message.audioUrl);
    audioPlayerRef.current = audio;
    setPlayingMessageId(message.id);

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.onended = () => {
      setPlayingMessageId(null);
      setPlaybackProgress(0);
    };

    audio.play().catch((err) => {
      console.warn('Audio playback error, using simulated sound wave:', err);
      // Fallback timer simulation
      let progress = 0;
      const duration = message.audioDuration || 4;
      const interval = setInterval(() => {
        progress += 100 / (duration * 10);
        if (progress >= 100) {
          clearInterval(interval);
          setPlayingMessageId(null);
          setPlaybackProgress(0);
        } else {
          setPlaybackProgress(progress);
        }
      }, 100);
    });
  };

  // Start Real Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission not granted:', err);
      window.alert('Allow microphone access to record a voice note.');
    }
  };

  // Cancel Recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // Send Recorded Voice Note
  const sendVoiceNote = () => {
    const duration = Math.max(1, recordingDuration);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        void dispatchVoiceNoteMessage(audioBlob, duration);
        mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // Helper to create synthetic audio so voice notes ALWAYS play back anywhere
  const createSyntheticVoiceNoteAudio = (duration: number): string => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const sampleRate = ctx.sampleRate;
      const numSamples = sampleRate * duration;
      const buffer = ctx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < numSamples; i++) {
        // Melodic human-like voice synthesis
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * 220 * t) * 0.25 * Math.sin(2 * Math.PI * 4 * t);
      }

      // Encode to wav blob
      const wavBlob = audioBufferToWav(buffer);
      return URL.createObjectURL(wavBlob);
    } catch {
      return '';
    }
  };

  // WAV encoder helper
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }
    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  };

  const dispatchVoiceNoteMessage = async (audioBlob: Blob, duration: number) => {
    if (!activeConvId) return;
    try {
      const row = await sendVoiceMessage(activeConvId, currentUser.id, audioBlob, duration);
      const msg = toDirectMessage(row, { me: currentUser.id, myName: currentUser.name }, currentUser.name);
      setConversations((prev) => mergeMessage(prev, msg));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Voice note not sent');
    }
  };

  // Send Text Message
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;
    const text = inputText.trim();
    setInputText('');
    try {
      const row = await sendTextMessage(activeConvId, currentUser.id, text);
      const msg = toDirectMessage(row, { me: currentUser.id, myName: currentUser.name }, currentUser.name);
      setConversations((prev) => mergeMessage(prev, msg));
    } catch (err) {
      setInputText(text);
      window.alert(err instanceof Error ? err.message : 'Message not sent');
    }
  };

  // Send coins to a contact: a real transfer and a chat message, in one database transaction
  const handleSendCoins = async (amount: number, noteText: string) => {
    if (!activeConvId || !activeConversation) return;
    try {
      const balance = await sendCoinsChat(activeConvId, amount, noteText);
      onUpdateUser({ coins: balance });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Coins could not be sent.');
    }
  };

  // New chat: only real FaceYou users, found by their handle
  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newChatHandle.trim();
    if (!handle) return;
    try {
      const person = await findUserByHandle(handle);
      if (!person) {
        window.alert('No FaceYou user has that handle.');
        return;
      }
      if (person.id === currentUser.id) {
        window.alert("That's your own handle.");
        return;
      }
      const convId = await startConversation(person.id);
      setConversations((prev) =>
        prev.some((c) => c.id === convId)
          ? prev
          : [
              {
                id: convId,
                participant: { id: person.id, name: person.name, handle: person.handle, avatar: person.avatar, online: false },
                unreadCount: 0,
                messages: [],
              },
              ...prev,
            ]
      );
      setActiveConvId(convId);
      setShowNewChatModal(false);
      setNewChatName('');
      setNewChatHandle('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not start the chat');
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.participant.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-950 text-white select-none">
      {/* Left Column: Conversations Inbox */}
      <div className="w-full md:w-80 lg:w-96 border-r border-white/10 flex flex-col bg-neutral-900/60 shrink-0">
        {/* Inbox Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-white">
              Direct Messages
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-[#ff0050] font-bold">
              {conversations.length}
            </span>
          </div>

          <button
            onClick={() => setShowNewChatModal(true)}
            className="w-8 h-8 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white flex items-center justify-center transition-all shadow-md active:scale-95"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-white/5">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts or creators..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              <p className="text-xs font-semibold mb-3">No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              >
                + Start Conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              const lastMsg = conv.lastMessage;

              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-rose-500/15 border-l-4 border-[#ff0050]'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={conv.participant.avatar}
                      alt={conv.participant.name}
                      className="w-12 h-12 rounded-full object-cover border border-white/10"
                    />
                    {conv.participant.online && (
                      <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-black absolute bottom-0 right-0" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-white truncate">
                        {conv.participant.name}
                      </span>
                      {lastMsg && (
                        <span className="text-[10px] text-neutral-500">
                          {new Date(lastMsg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-400 truncate flex items-center gap-1">
                      {lastMsg?.audioUrl ? (
                        <>
                          <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-cyan-400 font-medium">
                            Voice Note ({lastMsg.audioDuration || 3}s)
                          </span>
                        </>
                      ) : (
                        lastMsg?.text || 'Start chatting...'
                      )}
                    </p>
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#ff0050] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Conversation */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
          {/* Conversation Header */}
          <div className="h-16 px-5 border-b border-white/10 bg-neutral-900/40 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={activeConversation.participant.avatar}
                  alt={activeConversation.participant.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/20"
                />
                {activeConversation.participant.online && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black absolute bottom-0 right-0" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-white leading-tight">
                  {activeConversation.participant.name}
                </span>
                <span className="text-[11px] text-neutral-400 leading-tight">
                  {activeConversation.participant.handle} •{' '}
                  <span className="text-emerald-400 font-semibold">Online</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSendCoinModal(true)}
                className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Send Coins to this user"
              >
                <Coins className="w-3.5 h-3.5 fill-amber-950" />
                <span>Send Coins</span>
              </button>

              
              <button
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                title="Voice Call"
                onClick={() => activeConversation && call.startCall(activeConversation.participant, 'audio')}
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                title="Video Call"
                onClick={() => activeConversation && call.startCall(activeConversation.participant, 'video')}
              >
                <VideoCallIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {activeConversation.messages.map((msg) => {
              const isSelf = msg.isSelf;
              const isVoice = Boolean(msg.audioUrl);
              const isPlaying = playingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[78%] sm:max-w-[65%] ${
                    isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl p-3 shadow-md ${
                      isSelf
                        ? 'bg-gradient-to-r from-rose-600 to-[#ff0050] text-white rounded-tr-none'
                        : 'bg-neutral-800 text-neutral-100 rounded-tl-none border border-white/5'
                    }`}
                  >
                    {/* Coin Gift Transfer Bubble */}
                    {msg.isCoinGift ? (
                      <div className="flex flex-col gap-2 min-w-[210px] sm:min-w-[250px]">
                        <div className="flex items-center gap-2.5 bg-black/40 px-3 py-2.5 rounded-xl border border-amber-400/40">
                          <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-md shrink-0">
                            <Coins className="w-5 h-5 fill-amber-950" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-amber-300 leading-tight">
                              +{msg.coinAmount?.toLocaleString()} FaceYou Coins
                            </span>
                            <span className="text-[10px] text-neutral-300 font-semibold mt-0.5">
                              {isSelf ? 'Sent in chat' : 'Received in inbox'}
                            </span>
                          </div>
                        </div>
                        {msg.text && (
                          <p className="text-xs sm:text-sm font-medium px-1 leading-relaxed text-white">
                            {msg.text}
                          </p>
                        )}
                      </div>
                    ) : isVoice ? (
                      <div className="flex items-center gap-3 min-w-[210px] sm:min-w-[260px]">
                        {/* Play/Pause Button */}
                        <button
                          onClick={() => togglePlayAudio(msg)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md shrink-0 ${
                            isSelf
                              ? 'bg-white text-rose-600 hover:bg-neutral-100'
                              : 'bg-[#ff0050] text-white hover:bg-[#e00047]'
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>

                        {/* Audio Waveform Visualization */}
                        <div className="flex-1 flex flex-col justify-center gap-1">
                          <div className="flex items-center gap-0.5 h-6">
                            {[14, 22, 10, 28, 16, 24, 12, 30, 18, 26, 14, 22, 12, 28, 16].map(
                              (height, i) => (
                                <span
                                  key={i}
                                  className={`w-1 rounded-full transition-all ${
                                    isSelf ? 'bg-white' : 'bg-rose-400'
                                  } ${isPlaying ? 'animate-pulse' : 'opacity-80'}`}
                                  style={{
                                    height: isPlaying ? `${Math.max(6, (height * (1 + Math.sin(Date.now() / 100 + i))) / 2)}px` : `${height * 0.7}px`,
                                  }}
                                />
                              )
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] opacity-80 font-mono">
                            <span>🎙️ Voice Note</span>
                            <span>{msg.audioDuration ? `0:${msg.audioDuration.toString().padStart(2, '0')}` : '0:04'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Regular Text Message */
                      <p className="text-xs sm:text-sm font-medium leading-relaxed break-words">
                        {msg.text}
                      </p>
                    )}
                  </div>

                  {/* Timestamp & Status */}
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-neutral-500">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isSelf && (
                      <span>
                        <CheckCheck className="w-3 h-3 text-cyan-400 inline" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar / Voice Note Recorder */}
          <div className="p-3 sm:p-4 border-t border-white/10 bg-neutral-900/60 backdrop-blur-md">
            {isRecording ? (
              /* Active Voice Note Recording Interface */
              <div className="flex items-center justify-between gap-3 bg-neutral-900 border border-rose-500/40 rounded-full px-4 py-2.5 shadow-lg animate-pulse">
                <div className="flex items-center gap-2 text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <Mic className="w-4 h-4" />
                  <span className="text-xs font-mono font-bold">
                    Recording... 0:
                    {recordingDuration.toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Animated wave bars while recording */}
                <div className="flex items-center gap-1 h-4">
                  {[12, 20, 14, 24, 16, 22].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-rose-500 rounded-full animate-bounce"
                      style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelRecording}
                    className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                    title="Cancel Recording"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                  <button
                    onClick={sendVoiceNote}
                    className="px-4 py-1.5 rounded-full bg-[#ff0050] hover:bg-[#e00047] text-white text-xs font-bold flex items-center gap-1 shadow-md"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Regular Text & Voice Note Trigger */
              <form onSubmit={handleSendText} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message or record a voice note..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-full pl-4 pr-10 py-3 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff0050] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setInputText((prev) => prev + ' 💖')}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-white"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                </div>

                {/* Send Coins Button */}
                <button
                  type="button"
                  onClick={() => setShowSendCoinModal(true)}
                  className="w-11 h-11 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md shadow-amber-400/20 shrink-0 cursor-pointer"
                  title="Send Coins to Contact"
                >
                  <Coins className="w-5 h-5 fill-amber-950" />
                </button>

                {/* Voice Note Button */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-11 h-11 rounded-full bg-neutral-800 hover:bg-neutral-700 text-cyan-400 hover:text-cyan-300 border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md shrink-0 cursor-pointer"
                  title="Record Voice Note"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Send Text Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-11 h-11 rounded-full bg-[#ff0050] hover:bg-[#e00047] disabled:opacity-40 disabled:hover:bg-[#ff0050] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md shadow-rose-600/30 shrink-0 cursor-pointer"
                  title="Send Message"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-neutral-500">
          <p className="text-base font-bold text-white mb-1">Select a conversation</p>
          <p className="text-xs">Or start a new chat to exchange messages and voice notes</p>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-1">Start New Chat</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Connect directly with any creator or friend
            </p>

            <form onSubmit={handleCreateNewChat} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  placeholder="e.g. Maya Dancer"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#ff0050]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                  Username Handle (Optional)
                </label>
                <input
                  type="text"
                  value={newChatHandle}
                  onChange={(e) => setNewChatHandle(e.target.value)}
                  placeholder="e.g. @maya_dance"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#ff0050]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#ff0050] hover:bg-[#e00047] text-white font-bold text-xs shadow-md shadow-rose-600/30"
                >
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Coin Modal in Inbox */}
      {activeConversation && (
        <SendCoinModal
          isOpen={showSendCoinModal}
          onClose={() => setShowSendCoinModal(false)}
          currentUser={currentUser}
          recipient={activeConversation.participant}
          onConfirmSend={handleSendCoins}
          onOpenRecharge={onOpenRecharge}
        />
      )}
    </div>
  );
};
