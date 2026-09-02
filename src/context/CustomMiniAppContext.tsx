"use client";

/**
 * Custom MiniApp Context
 * 
 * @neynar/react의 MiniAppProvider가 Next.js 15 / React 19와 호환되지 않아서
 * @farcaster/miniapp-sdk를 직접 사용하는 커스텀 컨텍스트입니다.
 * 
 * useMiniApp 훅과 동일한 인터페이스를 제공합니다.
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
// import { Tab } from '~/components/App';

// Type for context - using inferred type from sdk.context
type MiniAppContextType = Awaited<typeof sdk.context>;

// Types
interface CustomMiniAppState {
    isSDKLoaded: boolean;
    context: MiniAppContextType | null;
    actions: typeof sdk.actions;
    client: typeof sdk;
    currentTab: string;
    setInitialTab: (tab: string) => void;
    setActiveTab: (tab: string) => void;
}

const defaultState: CustomMiniAppState = {
    isSDKLoaded: false,
    context: null,
    actions: sdk.actions,
    client: sdk,
    currentTab: 'Home',
    setInitialTab: () => { },
    setActiveTab: () => { },
};

const CustomMiniAppContext = createContext<CustomMiniAppState>(defaultState);

/**
 * Custom MiniApp Provider
 * 
 * @farcaster/miniapp-sdk를 직접 사용하여 MiniApp 기능을 제공합니다.
 */
export function CustomMiniAppProvider({ children }: { children: React.ReactNode }) {
    const [isSDKLoaded, setIsSDKLoaded] = useState(false);
    const [context, setContext] = useState<MiniAppContextType | null>(null);
    const [currentTab, setCurrentTab] = useState<string>('Home');
    const initialTabSet = useRef(false);
    const isInitialized = useRef(false);

    // setInitialTab - 초기 탭 설정 (한 번만 설정됨)
    const setInitialTab = useCallback((tab: string) => {
        if (!initialTabSet.current) {
            setCurrentTab(tab);
            initialTabSet.current = true;
        }
    }, []);

    // setActiveTab - 현재 탭 변경
    const setActiveTab = useCallback((tab: string) => {
        setCurrentTab(tab);
    }, []);

    // SDK 초기화
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initSDK = async () => {
            try {
                // SDK context 로드
                const ctx = await sdk.context;
                setContext(ctx);

                setIsSDKLoaded(true);

                // 호스트(Warpcast 등)에게 준비 완료 알림 → 스플래시 해제
                try {
                    await sdk.actions.ready();
                } catch (readyError) {
                    console.warn("[CustomMiniAppProvider] sdk.actions.ready() failed:", readyError);
                }
            } catch (error) {
                console.error("[CustomMiniAppProvider] SDK initialization failed:", error);
                setIsSDKLoaded(true); // 에러가 나도 로드 완료로 처리
            }
        };

        initSDK();
    }, []);

    // Memoized actions wrapper
    const actions = useMemo(() => sdk.actions, []);

    // Memoized context value
    const value = useMemo<CustomMiniAppState>(() => ({
        isSDKLoaded,
        context,
        actions,
        client: sdk,
        currentTab,
        setInitialTab,
        setActiveTab,
    }), [isSDKLoaded, context, actions, currentTab, setInitialTab, setActiveTab]);

    return (
        <CustomMiniAppContext.Provider value={value}>
            {children}
        </CustomMiniAppContext.Provider>
    );
}

/**
 * useCustomMiniApp Hook
 * 
 * useMiniApp과 동일한 인터페이스를 제공합니다.
 */
export function useCustomMiniApp() {
    const context = useContext(CustomMiniAppContext);

    if (context === undefined) {
        throw new Error('useCustomMiniApp must be used within a CustomMiniAppProvider');
    }

    return context;
}

/**
 * useMiniApp 호환 훅 (별칭)
 * 기존 코드와의 호환성을 위해 제공
 */
export const useMiniApp = useCustomMiniApp;

export default CustomMiniAppContext;
