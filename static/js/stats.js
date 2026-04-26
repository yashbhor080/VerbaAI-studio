// static/js/stats.js
import { getSelectedDomain } from './topic.js';

const STATS_KEY = 'verba_ai_stats';
const HISTORY_KEY = 'verba_ai_history';

const defaultStats = {
    xp: 0, sessionsCompleted: 0, minutesPracticed: 0,
    improvementPoints: 0, streak: 0, lastPracticeDate: null,
    dailyMinutes: 0, lastGoalDate: null, totalWordsSpoken: 0,
    usedLanguages: [], badges: [], dailyActivity: {}, dailyGoalMinutes: 5
};

export function loadStats() {
    const s = localStorage.getItem(STATS_KEY);
    return s ? { ...defaultStats, ...JSON.parse(s) } : { ...defaultStats };
}

export function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    updateStatsUI();
}

export function loadHistory() {
    const s = localStorage.getItem(HISTORY_KEY);
    return s ? JSON.parse(s) : [];
}

export function saveHistory(h) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export function getDailyTopic() {
    const topics = [
        "The Future of Artificial Intelligence",
        "Sustainable Living in Urban Cities",
        "The Impact of Social Media on Mental Health",
        "Exploring the Mysteries of Deep Space",
        "The Evolution of Global Communication",
        "Benefits of Learning a Second Language",
        "The Role of Robotics in Modern Medicine"
    ];
    const day = new Date().getDate(), month = new Date().getMonth();
    return topics[(day + month) % topics.length];
}

export function getLevelInfo(totalXp) {
    let level = 1, nextLevelXp = 100, baseLevelXp = 0;
    while (totalXp >= nextLevelXp) {
        level++;
        baseLevelXp = nextLevelXp;
        nextLevelXp += level * 100;
    }
    const xpInLevel = totalXp - baseLevelXp;
    const xpRequired = nextLevelXp - baseLevelXp;
    return { level, nextLevelXp, progress: Math.min(100, (xpInLevel / xpRequired) * 100) };
}

export function completeSession(durationSeconds, wordCount = 0, fillerCount = 0) {
    let stats = loadStats();
    let history = loadHistory();

    if (wordCount < 10) return { xpGained: 0, impPoints: 0, lowSpeech: true };

    const minutes = Math.max(1, Math.floor(durationSeconds / 60));
    let xpGained = 50 + (minutes * 10) + Math.floor(wordCount / 5);
    const impPoints = Math.floor(Math.random() * 5) + 1;

    // Daily challenge bonus
    const topicEl = document.getElementById('topic-text');
    if (topicEl && topicEl.textContent.trim() === getDailyTopic().trim()) xpGained *= 2;

    stats.xp += xpGained;
    stats.sessionsCompleted += 1;
    stats.minutesPracticed += minutes;
    stats.improvementPoints += impPoints;

    const today = new Date().toDateString();
    if (stats.lastGoalDate !== today) { stats.dailyMinutes = minutes; stats.lastGoalDate = today; }
    else { stats.dailyMinutes += minutes; }
    if (stats.lastPracticeDate !== today) stats.streak += 1;

    const oldLevel = getLevelInfo(stats.xp - xpGained).level;
    const newLevel = getLevelInfo(stats.xp).level;
    if (newLevel > oldLevel) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('levelUp', { detail: { level: newLevel } })), 500);
    }

    stats.lastPracticeDate = today;
    stats.totalWordsSpoken += wordCount;

    const langSelect = document.getElementById('language-select');
    const lang = langSelect ? langSelect.value : 'en-US';
    if (!stats.usedLanguages.includes(lang)) stats.usedLanguages.push(lang);

    if (!stats.dailyActivity[today]) stats.dailyActivity[today] = 0;
    stats.dailyActivity[today] += wordCount;

    // Achievements
    const unlockBadge = (id) => {
        if (!stats.badges.includes(id)) {
            stats.badges.push(id);
            const map = {
                'badge-first': { name: 'First Step', icon: '🎖️' },
                'badge-words': { name: 'Word Smith', icon: '✍️' },
                'badge-speed': { name: 'Speed Demon', icon: '🚀' },
                'badge-streak': { name: 'Loyal Speaker', icon: '🔥' },
                'badge-polyglot': { name: 'Polyglot', icon: '🌐' }
            };
            const b = map[id];
            if (b) window.dispatchEvent(new CustomEvent('badgeUnlocked', { detail: b }));
        }
    };

    if (stats.sessionsCompleted >= 1) unlockBadge('badge-first');
    if (stats.totalWordsSpoken >= 500) unlockBadge('badge-words');
    if (stats.streak >= 3) unlockBadge('badge-streak');
    if (stats.usedLanguages.length >= 2) unlockBadge('badge-polyglot');
    const wpmEl = document.getElementById('live-wpm');
    if (wpmEl && parseInt(wpmEl.textContent) >= 120) unlockBadge('badge-speed');

    saveStats(stats);

    const topic = topicEl?.textContent || "General Practice";
    const wpm = wpmEl?.textContent || "0";
    history.unshift({ date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), topic, duration: minutes, xp: xpGained, words: wordCount, wpm, lang, fillers: fillerCount });
    if (history.length > 20) history.pop();
    saveHistory(history);

    return { xpGained, impPoints, lowSpeech: false };
}

export function updateStatsUI() {
    const stats = loadStats();
    const today = new Date().toDateString();
    if (stats.lastGoalDate !== today) { stats.dailyMinutes = 0; stats.lastGoalDate = today; saveStats(stats); return; }

    const levelInfo = getLevelInfo(stats.xp);

    // Update daily challenge topic
    const dtEl = document.getElementById('daily-challenge-topic');
    if (dtEl) dtEl.textContent = getDailyTopic();

    // Core stat elements
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('xp-display', stats.xp);
    set('xp-next-level', levelInfo.nextLevelXp);
    set('level-display', levelInfo.level);
    set('sessions-count', stats.sessionsCompleted);
    set('minutes-count', stats.minutesPracticed);
    set('improvement-count', stats.improvementPoints);
    set('streak-count', stats.streak);

    // XP Progress Bar
    const xpBar = document.getElementById('xp-progress-bar');
    if (xpBar) xpBar.style.width = `${levelInfo.progress}%`;

    // Daily Goal
    const goalMinutes = stats.dailyGoalMinutes || 5;
    const goalPercent = Math.min(100, Math.round((stats.dailyMinutes / goalMinutes) * 100));
    const goalText = document.getElementById('goal-status-text');
    const goalPerc = document.getElementById('goal-percent');
    const goalRing = document.getElementById('goal-progress-circle') || document.getElementById('goal-ring-circle');
    const goalMiniBar = document.getElementById('goal-mini-bar');
    if (goalText) goalText.textContent = `${stats.dailyMinutes} / ${goalMinutes} Minutes`;
    if (goalPerc) goalPerc.textContent = `${goalPercent}%`;
    if (goalRing) {
        try {
            const r = goalRing.r?.baseVal?.value || 45;
            const circ = 2 * Math.PI * r;
            goalRing.style.strokeDasharray = circ;
            goalRing.style.strokeDashoffset = circ - (circ * goalPercent / 100);
        } catch(e) {}
    }
    if (goalMiniBar) goalMiniBar.style.width = `${goalPercent}%`;

    // Goal Editor
    const editBtn = document.getElementById('edit-goal-btn');
    const editor = document.getElementById('goal-editor');
    const saveBtn = document.getElementById('save-goal-btn');
    const goalInput = document.getElementById('goal-input');
    if (editBtn && editor) {
        editBtn.onclick = () => { editor.style.display = editor.style.display === 'none' ? 'flex' : 'none'; if (goalInput) goalInput.value = goalMinutes; };
    }
    if (saveBtn && goalInput) {
        saveBtn.onclick = () => {
            const v = parseInt(goalInput.value);
            if (v >= 1 && v <= 60) { stats.dailyGoalMinutes = v; saveStats(stats); if (editor) editor.style.display = 'none'; }
        };
    }

    renderHistoryTable();
    renderPerformanceChart();
    renderBadges(stats.badges);
    renderHeatmap(stats.dailyActivity);
    renderInsights();
    updateDashboardVerba(stats, levelInfo);
    renderRadarChart(stats);
    updateGlobalRank(stats);
    updateRewards(levelInfo.level);
}

function updateRewards(level) {
    const locked = document.getElementById('cert-locked');
    const unlocked = document.getElementById('cert-unlocked');
    if (!locked || !unlocked) return;
    if (level >= 20) { locked.style.display = 'none'; unlocked.style.display = 'block'; }
}

window.generateCertificate = () => {
    const stats = loadStats();
    const history = loadHistory();
    let peakWpm = 0;
    history.forEach(s => { if (parseInt(s.wpm) > peakWpm) peakWpm = parseInt(s.wpm); });
    const w = window.open('', '_blank', 'width=820,height=620');
    w.document.write(`<!DOCTYPE html><html><head><title>VerbaAI Certificate</title>
    <style>body{background:#0a0a0c;color:#fff;font-family:Georgia,serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.cert{border:10px double #facc15;padding:3rem;max-width:700px;text-align:center;background:#16161a;position:relative}h1{color:#facc15;font-size:2.5rem;text-transform:uppercase;margin-bottom:.3rem}h2{font-size:1.2rem;opacity:.7;margin:0 0 2rem}.name{font-size:2rem;font-weight:900;border-bottom:2px solid #facc15;padding:0 2rem;display:inline-block;margin-bottom:2rem}.stats{display:flex;justify-content:center;gap:2rem;opacity:.7;font-size:.9rem;margin-bottom:2rem}.seal{position:absolute;bottom:15px;right:15px;font-size:3rem;opacity:.15}.footer{font-size:.75rem;opacity:.4}button{background:#facc15;border:none;padding:.5rem 1.5rem;cursor:pointer;font-weight:800;margin-top:1rem;border-radius:5px}</style></head>
    <body><div class="cert"><h1>Certificate of Mastery</h1><h2>This certifies that a Speaker has achieved</h2><div class="name">MASTER ORATOR</div>
    <div class="stats"><div>Level: ${getLevelInfo(stats.xp).level}</div><div>Peak WPM: ${peakWpm}</div><div>Words: ${stats.totalWordsSpoken || 0}</div></div>
    <div class="seal">🛡️</div><div class="footer">Verified by VerbaAI Engine · ${new Date().toLocaleDateString()}</div>
    <button onclick="window.print()">Print Certificate</button></div></body></html>`);
};

function updateGlobalRank(stats) {
    const xp = stats.xp || 0;
    let pct = xp === 0 ? 100 : Math.max(1, 100 - (Math.log10(xp + 1) * 25));
    let tier = "Novice Speaker", icon = "🥉", prog = (xp / 1000) * 100;
    if (xp >= 10000) { tier = "Grandmaster Orator"; icon = "💎"; prog = 100; }
    else if (xp >= 5000) { tier = "Elite Public Speaker"; icon = "👑"; prog = ((xp - 5000) / 5000) * 100; }
    else if (xp >= 2500) { tier = "Expert Communicator"; icon = "🥇"; prog = ((xp - 2500) / 2500) * 100; }
    else if (xp >= 1000) { tier = "Adept Storyteller"; icon = "🥈"; prog = ((xp - 1000) / 1500) * 100; }

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rank-percentile', `Top ${pct.toFixed(1)}%`);
    set('rank-tier', tier);
    set('rank-icon', icon);
    const bar = document.getElementById('rank-progress');
    if (bar) bar.style.width = `${Math.min(100, prog)}%`;
}

let radarChart = null;
function renderRadarChart(stats) {
    const ctx = document.getElementById('dna-radar-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    const history = loadHistory();
    const fluency = Math.min(100, stats.sessionsCompleted > 0 ? (stats.totalWordsSpoken / Math.max(1, stats.minutesPracticed) / 1.5) : 0);
    const consistency = Math.min(100, (Object.keys(stats.dailyActivity).length / 30) * 100);
    const vocabulary = Math.min(100, (stats.totalWordsSpoken / 5000) * 100);
    const avgFillers = history.length > 0 ? history.reduce((a, b) => a + (parseInt(b.fillers) || 0), 0) / history.length : 0;
    const precision = Math.max(0, 100 - avgFillers * 10);
    const versatility = Math.min(100, stats.usedLanguages.length * 20 + stats.sessionsCompleted * 2);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#38bdf8';
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: ['Fluency', 'Consistency', 'Vocabulary', 'Precision', 'Versatility'], datasets: [{ label: 'Speaker DNA', data: [fluency, consistency, vocabulary, precision, versatility], backgroundColor: 'rgba(56,189,248,0.2)', borderColor: accent, pointBackgroundColor: accent, borderWidth: 3, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: 'rgba(255,255,255,0.1)' }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 12, weight: 'bold' } }, ticks: { display: false }, suggestedMin: 0, suggestedMax: 100 } }, plugins: { legend: { display: false } } }
    });
}

function updateDashboardVerba(stats, levelInfo) {
    const textEl = document.getElementById('dash-verba-text');
    const avatarEl = document.getElementById('dash-verba-avatar');
    const titleEl = document.getElementById('dash-greeting-title');
    if (!textEl) return;
    const h = new Date().getHours();
    const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    if (titleEl) titleEl.textContent = `${greeting}, Speaker!`;
    let msg = "Welcome back! Ready to sharpen those speaking skills today?", emoji = "🤖";
    if (stats.dailyMinutes >= stats.dailyGoalMinutes) { msg = "You've crushed your daily goal! Excellent dedication."; emoji = "😎"; }
    else if (stats.streak >= 3) { msg = `A ${stats.streak}-day streak! You're on fire!`; emoji = "🔥"; }
    else if (levelInfo.level >= 10) { msg = `Level ${levelInfo.level}! You're a true veteran.`; emoji = "🚀"; }
    else if (stats.dailyMinutes > 0) { msg = "Good start! A few more minutes to hit your target."; emoji = "💪"; }
    textEl.textContent = `"${msg}"`;
    if (avatarEl) avatarEl.textContent = emoji;
}

function renderInsights() {
    const history = loadHistory();
    if (history.length === 0) return;
    let langMap = {}, domainMap = {}, peakWpm = 0;
    history.forEach(s => {
        const lang = s.lang || "English";
        langMap[lang] = (langMap[lang] || 0) + 1;
        const domain = s.topic?.split(':')[0] || "General";
        domainMap[domain] = (domainMap[domain] || 0) + 1;
        if (parseInt(s.wpm) > peakWpm) peakWpm = parseInt(s.wpm);
    });
    const topLang = Object.keys(langMap).reduce((a, b) => langMap[a] > langMap[b] ? a : b, Object.keys(langMap)[0]);
    const topDomain = Object.keys(domainMap).reduce((a, b) => domainMap[a] > domainMap[b] ? a : b, Object.keys(domainMap)[0]);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (topLang) set('insight-lang', topLang.replace('en-US','English').replace('hi-IN','Hindi').replace('es-ES','Spanish'));
    if (topDomain) set('insight-domain', topDomain);
    set('insight-wpm', peakWpm);
}

function renderHeatmap(activity) {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toDateString(), count = activity[ds] || 0;
        const box = document.createElement('div');
        box.style.cssText = 'width:100%;padding-bottom:100%;border-radius:2px;';
        box.title = `${ds}: ${count} words`;
        if (count === 0) { box.style.background = 'var(--border)'; box.style.opacity = '0.3'; }
        else if (count < 100) box.style.background = 'rgba(56,189,248,0.3)';
        else if (count < 500) box.style.background = 'rgba(56,189,248,0.6)';
        else { box.style.background = 'var(--accent)'; box.style.boxShadow = '0 0 10px var(--accent)'; }
        grid.appendChild(box);
    }
}

function renderBadges(unlocked) {
    if (!unlocked) return;
    unlocked.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const icon = el.querySelector('.badge-icon');
            if (icon) { icon.style.filter = 'none'; icon.style.opacity = '1'; el.style.transform = 'scale(1.1)'; }
        }
    });
}

let performanceChart = null;
function renderPerformanceChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const history = loadHistory();
    const last10 = [...history].reverse().slice(-10);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#38bdf8';
    if (performanceChart) { performanceChart.destroy(); performanceChart = null; }
    performanceChart = new Chart(canvas, {
        type: 'line',
        data: { labels: last10.map(s => s.time), datasets: [{ label: 'WPM', data: last10.map(s => parseInt(s.wpm) || 0), borderColor: accent, backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: accent, pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } } }
    });
}

function renderHistoryTable() {
    const tbody = document.getElementById('history-body') || document.getElementById('history-table-body');
    if (!tbody) return;
    const history = loadHistory();
    tbody.innerHTML = '';
    if (history.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;opacity:0.5;">No sessions yet. Start practicing!</td></tr>'; return; }
    history.forEach(s => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `<td style="padding:1rem;font-size:.9rem;">${s.date} <span style="opacity:.5;font-size:.8rem;">${s.time}</span></td><td style="padding:1rem;font-size:.9rem;font-weight:600;">${s.topic}</td><td style="padding:1rem;">${s.words} words</td><td style="padding:1rem;"><span style="background:var(--accent);color:var(--bg);padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:bold;">${s.wpm} WPM</span></td><td style="padding:1rem;font-weight:bold;color:var(--accent);">+${s.xp} XP</td>`;
        tbody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', updateStatsUI);
