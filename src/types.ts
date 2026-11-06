export type FaceYouTab = 'feed' | 'live' | 'create' | 'inbox' | 'profile';

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  coins: number;
  followers: number;
  following: number;
  likes: number;
  diamonds: number;
  bio: string;
  joinedDate?: string;
  isVerified?: boolean;
  opayAccountName?: string;
  opayAccountNumber?: string;
  streamerLevel?: number;
  streamerXp?: number;
  totalStreamDurationSeconds?: number;
  coinsEarnedFromGifts?: number;
  streamLikesReceived?: number;
}

export interface PostVideo {
  id: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt?: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  caption: string;
  tags: string[];
  musicTitle: string;
  bgGradient: string;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  isLiked?: boolean;
}

export interface VideoComment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  likes: number;
  time: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatar?: string;
  text: string;
  type: 'user' | 'self' | 'system' | 'gift' | 'joined';
  badge?: string;
  giftName?: string;
  giftIcon?: string;
  cost?: number;
  timestamp: number;
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  color: string;
  tier: 'low' | 'med' | 'high';
  effectDescription: string;
}

export interface CoinPackage {
  id: string;
  coins: number;
  bonus: number;
  priceNgn: number;
  label: string;
  popular?: boolean;
}

export interface NotificationItem {
  id: string;
  type: 'follow' | 'gift' | 'message' | 'system';
  avatar: string;
  title: string;
  subtitle: string;
  time: string;
  unread: boolean;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  timestamp: number;
  isSelf: boolean;
  status?: 'sent' | 'delivered' | 'read';
  coinAmount?: number;
  isCoinGift?: boolean;
}

export interface Conversation {
  id: string;
  participant: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    online: boolean;
    bio?: string;
  };
  lastMessage?: DirectMessage;
  unreadCount: number;
  messages: DirectMessage[];
}

export interface CoinEarningRecord {
  id: string;
  type: 'live_stream_gift' | 'inbox_tip';
  sourceTitle: string;
  senderName: string;
  coins: number;
  diamondsEarned: number;
  timestamp: number;
}

export interface OPayWithdrawalRequest {
  id: string;
  accountName: string;
  phoneNumber: string;
  amountDiamonds: number;
  estimatedNgn: number;
  requestedAt: number;
  status: 'pending_monthly_payout' | 'processed';
  payoutMonth: string;
}
