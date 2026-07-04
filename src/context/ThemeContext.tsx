import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchAppSettings, updateAppSettings } from '../lib/appSettingsApi';

interface ThemeColors {
    focus: string;
    break: string;
}

interface ThemeContextType {
    colors: ThemeColors;
    updateColor: (mode: keyof ThemeColors, color: string) => void;
    resetTheme: () => void;
    leftImage: string | null;
    rightImage: string | null;
    updateLeftImage: (img: string | null) => void;
    updateRightImage: (img: string | null) => void;
}

const DEFAULT_THEME: ThemeColors = {
    focus: '#b91c1c',
    break: '#34d399',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [colors, setColors] = useState<ThemeColors>(DEFAULT_THEME);
    const [leftImage, setLeftImage] = useState<string | null>(null);
    const [rightImage, setRightImage] = useState<string | null>(null);
    const hasHydratedRef = useRef(false);
    const syncTimerRef = useRef<number | null>(null);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--accent-red', colors.focus);
        root.style.setProperty('--accent-green', colors.break);
    }, [colors]);

    useEffect(() => {
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
    }, [colors, leftImage, rightImage]);

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

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
