import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import {
    UIKitProvider,
    ConversationList,
    Chat,
    ChatHeader,
    MessageList,
    MessageInput,
    useConversationListState,
} from '@tencentcloud/chat-uikit-react';
import { useLoginStore } from 'tuikit-atomicx-react';
import AddFriendModal from '../components/modals/AddFriendModal';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';

// Inner component — lives INSIDE UIKitProvider to access store hooks
function ChatInner({ isAddFriendOpen, setIsAddFriendOpen, sdkAppId, userId, userSig, userName, userAvatar }) {
    const loginStore = useLoginStore();
    const { setActiveConversation } = useConversationListState();
    const [loginStatus, setLoginStatus] = useState('idle'); // idle | loading | success | error

    // Filter out non-critical background warnings emitted by Tencent TUIKit internal CoHostState module
    useEffect(() => {
        const originalConsoleError = console.error;
        console.error = (...args) => {
            const firstArg = args[0] ? String(args[0]) : '';
            if (firstArg.includes('[CoHostState]') || firstArg.includes('not inited')) {
                return;
            }
            originalConsoleError.apply(console, args);
        };

        return () => {
            console.error = originalConsoleError;
        };
    }, []);

    // Login via LoginStore (the correct way per Tencent architecture)
    useEffect(() => {
        if (!sdkAppId || !userId || !userSig) return;
        if (loginStatus !== 'idle') return;

        setLoginStatus('loading');
        loginStore.login({
            SDKAppID: sdkAppId,
            userID: userId.toString(),
            userSig: userSig,
        }).then(async () => {
            console.log('[Chat] LoginStore.login() success');
            setLoginStatus('success');
            // Sync real name & avatar to Tencent profile
            try {
                await loginStore.setSelfInfo({
                    nick: userName || userId,
                    ...(userAvatar ? { avatar: userAvatar } : {}),
                });
                console.log('[Chat] setSelfInfo ok, nick:', userName);
            } catch (e) {
                console.log('[Chat] setSelfInfo error (non-critical):', e?.message);
            }
        }).catch((e) => {
            console.error('[Chat] LoginStore.login() error:', e);
            // If already logged in, treat as success
            if (e?.code === 2 || String(e?.message).toLowerCase().includes('already')) {
                setLoginStatus('success');
            } else {
                setLoginStatus('error');
            }
        });
    }, [sdkAppId, userId, userSig]);

    const handleStartChat = useCallback(async (targetUser) => {
        console.log('[Chat] handleStartChat for:', targetUser?.full_name);

        const chat = loginStore?.getChat?.();
        console.log('[Chat] chat from loginStore:', chat ? 'OK' : 'NULL');

        const conversationID = `C2C${targetUser.id}`;

        if (chat) {
            // Add as Tencent friend (ignore if already friends)
            try {
                await chat.addFriend({
                    to: targetUser.id.toString(),
                    source: 'AddSource_Type_Web',
                    remark: targetUser.full_name,
                });
            } catch (e) {
                console.log('[Chat] addFriend (possibly already friends):', e?.code);
            }

            // Send initial message to create conversation on Tencent servers
            try {
                const msg = chat.createTextMessage({
                    to: targetUser.id.toString(),
                    conversationType: chat.TYPES?.CONV_C2C || 'C2C',
                    payload: { text: 'Hello! 👋' }
                });
                const result = await chat.sendMessage(msg);
                console.log('[Chat] sendMessage ok:', result?.code);
            } catch (e) {
                console.error('[Chat] sendMessage error:', e?.code, e?.message);
                if (e?.code !== 20009) {
                    alert(`Gagal kirim pesan: ${e?.message || e}`);
                    return;
                }
            }

            await new Promise(r => setTimeout(r, 600));
        }

        // Switch the active conversation in UIKit
        console.log('[Chat] setActiveConversation:', conversationID);
        setActiveConversation(conversationID);

    }, [loginStore, setActiveConversation]);

    if (loginStatus === 'loading' || loginStatus === 'idle') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Connecting to chat...</Typography>
            </Box>
        );
    }

    if (loginStatus === 'error') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <Typography color="error">Chat connection failed. Please refresh.</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={{ display: 'flex', width: '100%', height: '100%' }}>
                {/* Left: Conversation List */}
                <Box sx={{
                    width: '300px',
                    borderRight: '1px solid #EAEAEA',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Box sx={{ p: 1, borderBottom: '1px solid #EAEAEA' }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<PersonAddIcon />}
                            onClick={() => setIsAddFriendOpen(true)}
                            size="small"
                        >
                            Add Friend
                        </Button>
                    </Box>
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                        <ConversationList />
                    </Box>
                </Box>

                {/* Right: Chat Window */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Chat
                        PlaceholderEmpty={
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 1 }}>
                                <Typography variant="h4">💬</Typography>
                                <Typography variant="body2">Select a conversation to start chatting</Typography>
                            </Box>
                        }
                    >
                        <ChatHeader />
                        <MessageList />
                        <MessageInput />
                    </Chat>
                </Box>
            </Box>

            <AddFriendModal
                isOpen={isAddFriendOpen}
                onClose={() => setIsAddFriendOpen(false)}
                onStartChat={handleStartChat}
            />
        </>
    );
}

export default function ChatPage() {
    const { user } = useAuthStore();
    const [userSigData, setUserSigData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

    useEffect(() => {
        const fetchUserSig = async () => {
            if (!user) return;
            try {
                setLoading(true);
                const response = await api.get('/chat/usersig');
                setUserSigData(response.data.data);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch UserSig', err);
                setError('Failed to load chat credentials. Please check your SDKAppID and SecretKey in backend.');
            } finally {
                setLoading(false);
            }
        };
        fetchUserSig();
    }, [user]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3, textAlign: 'center', color: 'error.main', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography>{error}</Typography>
            </Box>
        );
    }

    if (!userSigData) return null;

    return (
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', height: 'calc(100vh - 61px)' }}>
            {/* UIKitProvider for theme/language only — login is handled by LoginStore inside ChatInner */}
            <UIKitProvider language="en">
                <ChatInner
                    isAddFriendOpen={isAddFriendOpen}
                    setIsAddFriendOpen={setIsAddFriendOpen}
                    sdkAppId={userSigData.sdkAppId}
                    userId={userSigData.userId}
                    userSig={userSigData.userSig}
                    userName={user?.full_name || user?.email}
                    userAvatar={user?.profile_picture_url || null}
                />
            </UIKitProvider>
        </Box>
    );
}
