import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'app_theme_mode';

const darkColors = {
  mode: 'dark',
  bg: '#0a1628',
  card: '#0f2040',
  border: 'rgba(201,168,76,0.2)',
  borderSoft: 'rgba(201,168,76,0.15)',
  gold: '#c9a84c',
  goldSoft: 'rgba(201,168,76,0.1)',
  text: '#f8f6f0',
  textSoft: '#c5cedd',
  textMuted: '#8a9ab5',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  overlay: 'rgba(0,0,0,0.25)',
};

const lightColors = {
  mode: 'light',
  bg: '#f5f3ed',
  card: '#ffffff',
  border: 'rgba(201,168,76,0.35)',
  borderSoft: 'rgba(201,168,76,0.25)',
  gold: '#a8843a',
  goldSoft: 'rgba(168,132,58,0.1)',
  text: '#0a1628',
  textSoft: '#33415c',
  textMuted: '#6b7a94',
  inputBg: 'rgba(10,22,40,0.04)',
  inputBorder: 'rgba(10,22,40,0.12)',
  overlay: 'rgba(0,0,0,0.08)',
};

const ThemeContext = createContext({
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
  ready: false,
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'light') setIsDark(false);
        else if (saved === 'dark') setIsDark(true);
      } catch (e) {
        // تجاهل، نستخدم الافتراضي (غامق)
      }
      setReady(true);
    })();
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch (e) {
      // تجاهل أخطاء الحفظ، الحالة تبقى محدثة بالذاكرة لهذه الجلسة
    }
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
