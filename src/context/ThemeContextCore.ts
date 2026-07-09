import { createContext } from 'react';

export interface ThemeColors {
    focus: string;
    break: string;
}

export interface ThemeContextType {
    colors: ThemeColors;
    updateColor: (mode: keyof ThemeColors, color: string) => void;
    resetTheme: () => void;
    leftImage: string | null;
    rightImage: string | null;
    updateLeftImage: (img: string | null) => void;
    updateRightImage: (img: string | null) => void;
}

export const DEFAULT_THEME: ThemeColors = {
    focus: '#b91c1c',
    break: '#34d399',
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
