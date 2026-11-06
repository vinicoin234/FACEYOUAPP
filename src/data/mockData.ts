import { GiftItem, CoinPackage, NotificationItem } from '../types';

export const FACEYOU_GIFTS: GiftItem[] = [
  {
    id: 'rose',
    name: 'Rose',
    icon: '🌹',
    cost: 1,
    color: '#fe2c55',
    tier: 'low',
    effectDescription: 'Floating red roses bloom'
  },
  {
    id: 'heart_me',
    name: 'Heart Me',
    icon: '💖',
    cost: 5,
    color: '#ff0050',
    tier: 'low',
    effectDescription: 'Heart explosion shower'
  },
  {
    id: 'donut',
    name: 'Sweet Donut',
    icon: '🍩',
    cost: 30,
    color: '#ff69b4',
    tier: 'low',
    effectDescription: 'Delicious sprinkles rain'
  },
  {
    id: 'car',
    name: 'Sports Car',
    icon: '🏎️',
    cost: 100,
    color: '#ff3b30',
    tier: 'med',
    effectDescription: 'Supercar drift and burn'
  },
  {
    id: 'rocket',
    name: 'Rocket Launch',
    icon: '🚀',
    cost: 250,
    color: '#ff9500',
    tier: 'high',
    effectDescription: 'Rocket blast through space'
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    icon: '🪐',
    cost: 500,
    color: '#a855f7',
    tier: 'high',
    effectDescription: 'Cosmic universe portal'
  },
  {
    id: 'lion',
    name: 'FaceYou Lion',
    icon: '🦁',
    cost: 1000,
    color: '#ffd700',
    tier: 'high',
    effectDescription: 'Golden Lion Roar & Solar Eclipse'
  },
  {
    id: 'universe',
    name: 'FaceYou Universe',
    icon: '👑',
    cost: 2000,
    color: '#25f4ee',
    tier: 'high',
    effectDescription: 'Royal FaceYou Crown Coronation'
  }
];

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'pkg-1',
    coins: 70,
    bonus: 0,
    priceNgn: 400,
    label: 'Starter Pack'
  },
  {
    id: 'pkg-2',
    coins: 350,
    bonus: 30,
    priceNgn: 1800,
    label: 'Popular Pack - Save 15%',
    popular: true
  },
  {
    id: 'pkg-3',
    coins: 1400,
    bonus: 180,
    priceNgn: 5500,
    label: 'Streamer Pack - Save 25%'
  },
  {
    id: 'pkg-4',
    coins: 3500,
    bonus: 600,
    priceNgn: 12500,
    label: 'VIP Whale - Save 35%'
  },
  {
    id: 'pkg-5',
    coins: 10500,
    bonus: 2500,
    priceNgn: 30000,
    label: 'Diamond Elite - Max Value'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'system',
    avatar: '✨',
    title: 'Welcome to FaceYou!',
    subtitle: 'Your creator account is live. Start streaming or send voice messages to friends.',
    time: 'Just now',
    unread: true
  }
];
