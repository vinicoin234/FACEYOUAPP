import React, { useState, useEffect, useRef } from 'react';
import { FaceYouBottomNav } from './components/FaceYouBottomNav';
import { FaceYouStudio } from './components/FaceYouStudio';
import { FaceYouLiveStream } from './components/FaceYouLiveStream';
import { MessagingPage } from './components/MessagingPage';
import { FaceYouProfile } from './components/FaceYouProfile';
import { FaceYouLoginPage } from './components/FaceYouLoginPage';
import { PaymentModal } from './components/PaymentModal';
import { EditProfileModal } from './components/EditProfileModal';
import { ShareModal } from './components/ShareModal';
import { UserSearchModal } from './components/UserSearchModal';
import { ViewersModal, StreamViewer } from './components/ViewersModal';
import { User, ChatMessage, GiftItem, Conversation, FaceYouTab, CoinEarningRecord, OPayWithdrawalRequest } from './types';
import { FACEYOU_GIFTS } from './data/mockData';
import { syncUserProfile } from './lib/supabase';
import { CallProvider } from './components/CallProvider';
import { fetchBalances } from './lib/money';
import { loadConversations, subscribeToMessages, toDirectMessage, mergeMessage } from './lib/chat';
import { AdminPayouts } from './components/AdminPayouts';
import { findMyLiveStreamId, loadStreamChat, sendStreamChat, subscribeStreamChat } from './lib/social';
import { LiveViewer, LiveHost } from './components/LiveViewer';

// Clean wipe of previous users to guarantee every user starts brand new
const CLEAN_STORAGE_VERSION = 'faceyou_v5_clean_users';
try {
  if (typeof window !== 'undefined') {
    const ver = localStorage.getItem('faceyou_storage_version');
    if (ver !== CLEAN_STORAGE_VERSION) {
      localStorage.clear();
      localStorage.setItem('faceyou_storage_version', CLEAN_STORAGE_VERSION);
    }
  }
} catch {
  // Ignore
}

const SESSION_KEY = 'faceyou_active_session_v5';
const CONVS_KEY = 'faceyou_conversations_v5';
const EARNINGS_KEY = 'faceyou_coin_earnings_v5';
const WITHDRAWALS_KEY = 'faceyou_opay_withdrawals_v5';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return null; // NO pre-seeded mock account, strictly requires sign up or login!
  });

  const [activeTab, setActiveTab] = useState<FaceYouTab>('feed');

  // Save active user session & sync with Supabase
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        syncUserProfile(user);

        // Also register in registered users list
        const registeredKey = 'faceyou_registered_users_v4';
        const existing = localStorage.getItem(registeredKey);
        let list: User[] = existing ? JSON.parse(existing) : [];
        if (!list.some((u) => u.id === user.id)) {
          list.push(user);
          localStorage.setItem(registeredKey, JSON.stringify(list));
        }
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Ignore
    }
  }, [user]);

  // Balances come from the server, never from the browser's saved copy
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchBalances(user.id).then((b) => {
      if (!cancelled && b) setUser((prev) => (prev ? { ...prev, coins: b.coins, diamonds: b.diamonds } : prev));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Conversations (Messaging & Voice Notes)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const knownConvIds = useRef<Set<string>>(new Set());
  knownConvIds.current = new Set(conversations.map((c) => c.id));

  // Real inbox: my conversations from the server, and new messages as they arrive
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const meta = { me: user.id, myName: user.name };
    const reload = () =>
      loadConversations(meta).then((list) => {
        if (!cancelled) setConversations(list);
      });
    void reload();
    const unsubscribe = subscribeToMessages((row) => {
      if (!knownConvIds.current.has(row.conversation_id)) {
        void reload(); // a conversation I didn't have yet
        return;
      }
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === row.conversation_id);
        const name = row.sender_id === user.id ? user.name : conv?.participant.name ?? 'Member';
        return mergeMessage(prev, toDirectMessage(row, meta, name));
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id, user?.name]);

  // Coin Earnings (Stream Gifts & Direct Inbox Tips)
  const [coinEarnings, setCoinEarnings] = useState<CoinEarningRecord[]>(() => {
    try {
      const saved = localStorage.getItem(EARNINGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(EARNINGS_KEY, JSON.stringify(coinEarnings));
    } catch {
      // Ignore
    }
  }, [coinEarnings]);

  // OPay Withdrawal Requests
  const [withdrawalRequests, setWithdrawalRequests] = useState<OPayWithdrawalRequest[]>(() => {
    try {
      const saved = localStorage.getItem(WITHDRAWALS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(withdrawalRequests));
    } catch {
      // Ignore
    }
  }, [withdrawalRequests]);

  const handleRecordCoinEarning = (record: CoinEarningRecord) => {
    setCoinEarnings((prev) => [record, ...prev]);
  };

  const handleAddWithdrawalRequest = (req: OPayWithdrawalRequest) => {
    setWithdrawalRequests((prev) => [req, ...prev]);
  };

  // LIVE Stream State
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamDuration, setStreamDuration] = useState<number>(0);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(user ? user.likes : 0);

  // Active Viewers & Blocked Stream Viewers State
  const [viewersList, setViewersList] = useState<StreamViewer[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  // LIVE Stream Chat Messages
  const [streamMessages, setStreamMessages] = useState<ChatMessage[]>([]);
  const [hostStreamId, setHostStreamId] = useState<string | null>(null);

  // While I am live: follow my stream's chat (the row appears a moment after going live)
  useEffect(() => {
    if (!isStreaming || !user) {
      setHostStreamId(null);
      setStreamMessages([]);
      return;
    }
    let cancelled = false;
    let unsubscribe = () => {};
    (async () => {
      for (let i = 0; i < 15 && !cancelled; i++) {
        const id = await findMyLiveStreamId(user.id);
        if (id) {
          if (cancelled) return;
          setHostStreamId(id);
          setStreamMessages(await loadStreamChat(id));
          unsubscribe = subscribeStreamChat(id, (m) =>
            setStreamMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-80), m]))
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isStreaming, user?.id]);


  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [shareTitle, setShareTitle] = useState<string>('Watch me live on FaceYou!');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isViewersModalOpen, setIsViewersModalOpen] = useState<boolean>(false);
  // Viewer side: the stream being watched (null = not watching)
  const [watching, setWatching] = useState<LiveHost | null>(null);

  // LIVE stream duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStreaming) {
      interval = setInterval(() => {
        setStreamDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setStreamDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  const handleBlockViewer = (userId: string) => {
    setBlockedUserIds((prev) => [...prev, userId]);
    setViewersList((prev) => prev.filter((v) => v.id !== userId));
    setViewerCount((prev) => Math.max(0, prev - 1));
  };

  const handleUnblockViewer = (userId: string) => {
    setBlockedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  // LIVE stream send message: stored on the server, and shown to everyone watching
  const handleSendStreamMessage = (text: string) => {
    if (!user || !hostStreamId) return;
    sendStreamChat(hostStreamId, user.name, text).catch((err: Error) => window.alert(err.message));
  };

  // Gifts are sent from the live viewer screen and settled on the server (see LiveViewer).
  const handleSendGift = (_gift: GiftItem) => {};

  // Payment success: the server has already credited the coins and returned the new balance
  const handlePaymentSuccess = (newBalance: number, packageLabel: string) => {
    if (!user) return;
    setUser((prev) => (prev ? { ...prev, coins: newBalance } : null));
    setStreamMessages((prev) => [
      ...prev,
      {
        id: 'sys_' + Date.now(),
        sender: 'FaceYou Coins',
        text: `🎉 Payment confirmed: ${packageLabel}. Your coin balance has been updated.`,
        type: 'system',
        timestamp: Date.now(),
      },
    ]);
  };

  const handleResetAccount = () => {
    if (window.confirm('Reset your FaceYou profile and clear all cached data?')) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(CONVS_KEY);
      localStorage.removeItem(EARNINGS_KEY);
      localStorage.removeItem(WITHDRAWALS_KEY);
      setUser(null);
      setCoinEarnings([]);
      setWithdrawalRequests([]);
    }
  };

  const handleDeleteCurrentUser = () => {
    if (window.confirm('Delete this account and start brand new? All your profile data, following, coins, and messages will be permanently deleted.')) {
      try {
        localStorage.clear();
      } catch {
        // Ignore
      }
      setUser(null);
      setConversations([]);
      setCoinEarnings([]);
      setWithdrawalRequests([]);
      setActiveTab('feed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const handleOpenShare = (title: string) => {
    setShareTitle(title);
    setIsShareOpen(true);
  };

  if (!user) {
    return <FaceYouLoginPage onLoginSuccess={(newUser) => setUser(newUser)} />;
  }

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0
  );

  return (
    <CallProvider currentUser={user}>
    <div className="w-screen h-screen flex flex-col bg-black text-white overflow-hidden select-none">
      <main className="flex-1 w-full h-full overflow-hidden relative">
        {activeTab === 'feed' && (
          <FaceYouStudio
            user={user}
            isStreaming={isStreaming}
            likeCount={likeCount}
            viewerCount={viewerCount}
            onGoLive={() => setActiveTab('live')}
            onOpenShare={handleOpenShare}
            onOpenSearch={() => setIsSearchOpen(true)}
            onWatchLive={() => setActiveTab('live')}
            onJoinStream={(host) => setWatching(host)}
          />
        )}

        {(activeTab === 'live' || activeTab === 'create') && (
          <FaceYouLiveStream
            user={user}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
            streamDuration={streamDuration}
            viewerCount={viewerCount}
            onViewerCountChange={setViewerCount}
            likeCount={likeCount}
            setLikeCount={setLikeCount}
            messages={streamMessages}
            onSendMessage={handleSendStreamMessage}
            onSendGift={handleSendGift}
            onOpenRecharge={() => setIsPaymentOpen(true)}
            onOpenShare={handleOpenShare}
            onOpenViewersModal={() => setIsViewersModalOpen(true)}
            onCloseStream={() => {
              setIsStreaming(false);
              setActiveTab('feed');
            }}
          />
        )}

        {activeTab === 'inbox' && (
          <div className="w-full h-full pb-14 sm:pb-16 flex flex-col">
            <MessagingPage
              currentUser={user}
              conversations={conversations}
              setConversations={setConversations}
              onUpdateUser={(updated) =>
                setUser((prev) => (prev ? { ...prev, ...updated } : null))
              }
              onRecordCoinEarning={handleRecordCoinEarning}
              onOpenRecharge={() => setIsPaymentOpen(true)}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <FaceYouProfile
            user={user}
            coinEarnings={coinEarnings}
            withdrawalRequests={withdrawalRequests}
            onUpdateUser={(updated) =>
              setUser((prev) => (prev ? { ...prev, ...updated } : null))
            }
            onAddWithdrawalRequest={handleAddWithdrawalRequest}
            onEditProfile={() => setIsEditProfileOpen(true)}
            onShareProfile={() => handleOpenShare(`Check out ${user.name}'s FaceYou profile!`)}
            onTopUpCoins={() => setIsPaymentOpen(true)}
            onGoLive={() => setActiveTab('live')}
            onResetAccount={handleResetAccount}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteCurrentUser}
          />
        )}
      </main>

      <FaceYouBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadMessagesCount={totalUnreadMessages}
        isStreaming={isStreaming}
        onStopStream={() => setIsStreaming(false)}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        userEmail={user.email}
        userId={user.id}
        onSuccess={handlePaymentSuccess}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        user={user}
        onUpdateUser={(updated) =>
          setUser((prev) => (prev ? { ...prev, ...updated } : null))
        }
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        streamerName={shareTitle}
      />

      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentUser={user}
        onJoinStream={(host) => {
          setIsSearchOpen(false);
          setWatching(host);
        }}
      />

      {user && <AdminPayouts userId={user.id} />}

      {watching && (
        <LiveViewer
          host={watching}
          viewer={user}
          onBalance={(coins) => setUser((prev) => (prev ? { ...prev, coins } : prev))}
          onClose={() => setWatching(null)}
        />
      )}

      <ViewersModal
        isOpen={isViewersModalOpen}
        onClose={() => setIsViewersModalOpen(false)}
        viewers={viewersList}
        isHost={true}
        blockedUserIds={blockedUserIds}
        onBlockUser={handleBlockViewer}
        onUnblockUser={handleUnblockViewer}
      />
    </div>
    </CallProvider>
  );
}
