const THEME_KEY = 'verba_ai_theme';
const AVAILABLE_THEMES = ['saas', 'cartoon', 'neon'];

export function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'saas';
    applyTheme(savedTheme);
}

export function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_KEY, themeName);
    
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.textContent = `Theme: ${themeName.charAt(0).toUpperCase() + themeName.slice(1)}`;
    }
}

export function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'saas';
    let nextIndex = (AVAILABLE_THEMES.indexOf(currentTheme) + 1) % AVAILABLE_THEMES.length;
    applyTheme(AVAILABLE_THEMES[nextIndex]);
}
