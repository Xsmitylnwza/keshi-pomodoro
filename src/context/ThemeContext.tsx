import React, { createContext, useContext, useEffect, useState } from 'react';

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
    focus: '#b91c1c', // accent-red
    break: '#34d399', // accent-green (Emerald 400)
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [colors, setColors] = useState<ThemeColors>(() => {
        const saved = localStorage.getItem('keshi-theme');
        return saved ? JSON.parse(saved) : DEFAULT_THEME;
    });

    const [leftImage, setLeftImage] = useState<string | null>(() => {
        return localStorage.getItem('keshi-bg-left');
    });

    const [rightImage, setRightImage] = useState<string | null>(() => {
        return localStorage.getItem('keshi-bg-right');
    });

    useEffect(() => {
        // Update CSS variables whenever colors change
        const root = document.documentElement;
        root.style.setProperty('--accent-red', colors.focus);
        root.style.setProperty('--accent-green', colors.break);

        // Save to storage
        localStorage.setItem('keshi-theme', JSON.stringify(colors));
    }, [colors]);

    useEffect(() => {
        if (leftImage) localStorage.setItem('keshi-bg-left', leftImage);
        else localStorage.removeItem('keshi-bg-left');
    }, [leftImage]);

    useEffect(() => {
        if (rightImage) localStorage.setItem('keshi-bg-right', rightImage);
        else localStorage.removeItem('keshi-bg-right');
    }, [rightImage]);

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
