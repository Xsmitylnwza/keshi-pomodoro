import React, { useEffect, useRef, useState } from 'react';
import { fetchAppSettings, updateAppSettings } from '../lib/appSettingsApi';
import { DEFAULT_THEME, ThemeContext, type ThemeColors } from './ThemeContextCore';
import { useAuth } from './useAuth';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const [colors, setColors] = useState<ThemeColors>(DEFAULT_THEME);
    const [leftImage, setLeftImage] = useState<string | null>(null);
    const [rightImage, setRightImage] = useState<string | null>(null);
    const hasHydratedRef = useRef(false);
    const syncTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (auth.loading || !auth.authenticated) return;
        let active = true;

        void fetchAppSettings()
            .then(({ settings }) => {
                if (!active) return;
                setColors({
                    focus: settings.theme?.focus ?? DEFAULT_THEME.focus,
                    break: settings.theme?.break ?? DEFAULT_THEME.break,
                });
                setLeftImage(settings.theme?.leftImage ?? null);
                setRightImage(settings.theme?.rightImage ?? null);
            })
            .catch(error => {
                console.warn('Theme sync failed', error);
            })
            .finally(() => {
                if (active) hasHydratedRef.current = true;
            });

        return () => {
            active = false;
        };
    }, [auth.authenticated, auth.loading]);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--accent-red', colors.focus);
        root.style.setProperty('--accent-green', colors.break);
    }, [colors]);

    useEffect(() => {
        if (!auth.authenticated) return;
        if (!hasHydratedRef.current) return;
        if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);

        syncTimerRef.current = window.setTimeout(() => {
            void updateAppSettings({
                theme: {
                    focus: colors.focus,
                    break: colors.break,
                    leftImage,
                    rightImage,
                },
            }).catch(error => {
                console.warn('Theme save failed', error);
            });
        }, 180);

        return () => {
            if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
        };
    }, [auth.authenticated, colors, leftImage, rightImage]);

    const updateColor = (mode: keyof ThemeColors, color: string) => {
        setColors(prev => ({ ...prev, [mode]: color }));
    };

    const updateLeftImage = (img: string | null) => setLeftImage(img);
    const updateRightImage = (img: string | null) => setRightImage(img);

    const resetTheme = () => {
        setColors(DEFAULT_THEME);
        setLeftImage(null);
        setRightImage(null);
    };

    return (
        <ThemeContext.Provider value={{
            colors, updateColor, resetTheme,
            leftImage, updateLeftImage,
            rightImage, updateRightImage
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
