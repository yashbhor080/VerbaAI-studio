// ═══════════════════════════════════════════════════════════════
//  VerbaAI Studio — main.js   (Complete & Clean)
// ═══════════════════════════════════════════════════════════════
import { completeSession, updateStatsUI } from './stats.js';
import { initTheme, toggleTheme }         from './theme.js';
import { loadTopics, setDomain }          from './topic.js';
import { initSpinWheel }                  from './spin.js';
import { initSpeech, startRecording, stopRecording } from './speech.js';

console.log('VerbaAI Studio ✓');

// ─── Module-level state ──────────────────────────────────────────────────────
let timerInterval    = null;
let feedbackInterval = null;
let prepInterval     = null;
let seconds          = 0;
let prepSeconds      = 30;
let isChallengeMode  = false;
let sessionFillers   = 0;
let lastSpeechTime   = Date.now();
let isNudging        = false;
let combo            = 0;
let isFeverMode      = false;
let lastThemeCmd     = 0;
let audioCtx, analyser, dataArray, rafId;
let talkingTimer     = null;

window.selectedDuration  = 1;      // minutes
window.isVoiceEnabled    = true;

// ─── Silence-aware TTS ───────────────────────────────────────────────────────
let verbaPending  = null;
let verbaTimer    = null;
let userTalking   = false;

function scheduleVoice(text) {
    if (!window.isVoiceEnabled || !window.speechSynthesis) return;
    verbaPending = text;
    clearTimeout(verbaTimer);
    if (userTalking) return;                         // wait until silence
    verbaTimer = setTimeout(() => {
        if (!verbaPending || userTalking) return;
        const u = new SpeechSynthesisUtterance(verbaPending);
        const sel = document.getElementById('language-select');
        u.lang  = sel ? sel.value : 'en-US';
        u.rate  = 1.0;
        u.pitch = 1.1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        verbaPending = null;
    }, 2200);
}

function stopVoice() {
    clearTimeout(verbaTimer);
    verbaPending = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// ─── Verba persona ───────────────────────────────────────────────────────────
function updateVerba(text, mood = 'neutral') {
    const txtEl = document.getElementById('verba-text');
    const avEl  = document.getElementById('verba-avatar');
    if (txtEl) txtEl.textContent = text;
    scheduleVoice(text);
    if (avEl) {
        const map = { neutral:'🤖', happy:'😊', listening:'👂', excited:'🚀', thinking:'🤔', proud:'😎' };
        avEl.textContent = map[mood] || '🤖';
    }
}

// ─── Sound ───────────────────────────────────────────────────────────────────
function playSound(id) {
    const el = document.getElementById(id);
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
}

// ─── Toast helper ────────────────────────────────────────────────────────────
function showToast(title, icon, msg, ms = 4000) {
    const g = id => document.getElementById(id);
    if (g('feedback-title'))   g('feedback-title').textContent   = title;
    if (g('feedback-icon'))    g('feedback-icon').textContent    = icon;
    if (g('feedback-message')) g('feedback-message').textContent = msg;
    const toast = g('feedback-toast');
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), ms); }
}

// ─── Waveform ────────────────────────────────────────────────────────────────
async function startWaveform() {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
        analyser  = audioCtx.createAnalyser();
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        (function draw() {
            rafId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            const w = canvas.width  = canvas.offsetWidth;
            const h = canvas.height = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);
            const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#38bdf8';
            ctx.lineWidth   = 3;
            ctx.strokeStyle = accent;
            ctx.beginPath();
            const step = w / dataArray.length;
            let x = 0;
            dataArray.forEach((v, i) => {
                const y = (v / 128) * h / 2;
                i === 0 ? ctx.moveTo(x, h - y) : ctx.lineTo(x, h - y);
                x += step;
            });
            ctx.lineTo(w, h / 2);
            ctx.stroke();
        })();
    } catch (e) { console.warn('Waveform:', e); }
}

function stopWaveform() {
    if (rafId)    cancelAnimationFrame(rafId);
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

// ─── Timer display ───────────────────────────────────────────────────────────
function updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const m = Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0');
    const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
}

// ─── Sentiment ───────────────────────────────────────────────────────────────
function updateSentiment(text) {
    const t = text.toLowerCase();
    const pos = ['happy','great','excellent','success','good','amazing','love','growth'].filter(w => t.includes(w)).length;
    const ana = ['because','therefore','analyze','think','impact','strategy','data','result'].filter(w => t.includes(w)).length;
    const hot = ['power','urgent','must','critical','danger','action','need','intense'].filter(w => t.includes(w)).length;
    const emoji = document.getElementById('sentiment-emoji');
    const txt   = document.getElementById('sentiment-text');
    if (!emoji || !txt) return;
    if (pos > ana && pos > hot)      { emoji.textContent = '😊'; txt.textContent = 'Positive / Upbeat';    txt.style.color = '#2ed573'; }
    else if (ana > pos && ana > hot) { emoji.textContent = '🧐'; txt.textContent = 'Analytical / Logical'; txt.style.color = 'var(--accent)'; }
    else if (hot > pos && hot > ana) { emoji.textContent = '🔥'; txt.textContent = 'Passionate / Urgent';  txt.style.color = '#ff4757'; }
    else                              { emoji.textContent = '😐'; txt.textContent = 'Neutral / Steady';     txt.style.color = 'var(--accent)'; }
}

// ─── Start practice ──────────────────────────────────────────────────────────
function triggerStart() {
    document.body.classList.add('focus-active');
    combo = 0; isFeverMode = false;
    document.body.classList.remove('fever-active');

    const g        = id => document.getElementById(id);
    const startBtn = g('start-btn');
    const endBtn   = g('end-btn');
    const skipBtn  = g('skip-prep-btn');
    const combo_c  = g('combo-container');
    const aiStatus = g('ai-status');
    const txSec    = g('transcript-section');

    if (startBtn)  startBtn.style.display  = 'none';
    if (skipBtn)   skipBtn.style.display   = 'none';
    if (endBtn)    endBtn.style.display    = 'inline-block';
    if (combo_c)   combo_c.style.display   = 'block';
    if (txSec)     txSec.style.display     = 'block';

    playSound('sound-start');
    startWaveform();

    isChallengeMode = window.selectedDuration > 0;
    seconds = isChallengeMode ? window.selectedDuration * 60 : 0;
    updateTimerDisplay();

    if (aiStatus) aiStatus.innerHTML = `<span class="status-dot listening"></span> Analyzing Speech...`;
    updateVerba("I'm listening! Speak clearly and at a natural pace.", 'listening');

    const langSel = document.getElementById('language-select');
    startRecording(langSel ? langSel.value : 'en-US');

    lastSpeechTime = Date.now();
    isNudging      = false;
    sessionFillers = 0;

    timerInterval = setInterval(() => {
        if (isChallengeMode) {
            seconds--;
            if (seconds <= 0) {
                clearInterval(timerInterval);
                clearInterval(feedbackInterval);
                window.endSessionManual();
                return;
            }
        } else { seconds++; }
        updateTimerDisplay();

        // Dead-air nudge (5 s silence)
        if (Date.now() - lastSpeechTime > 5000) {
            if (!isFeverMode) {
                combo = 0;
                const cb = document.getElementById('combo-bar');
                const ct = document.getElementById('combo-text');
                if (cb) cb.style.width   = '0%';
                if (ct) ct.textContent   = '0%';
            }
            if (!isNudging) {
                isNudging = true;
                const vb = document.getElementById('verba-persona-box');
                if (vb) vb.classList.add('nudge');
                updateVerba("Keep going! Don't lose the flow.", 'thinking');
            }
        }
    }, 1000);

    // Periodic silent text tips
    const msgs = document.getElementById('ai-messages');
    const tips = [
        { t: "Great pacing! You sound very confident.", m: 'proud' },
        { t: "Try to avoid filler words like 'um'. You got this!", m: 'thinking' },
        { t: "Excellent vocabulary! Keep it up.", m: 'excited' },
        { t: "Remember to breathe between sentences.", m: 'happy' }
    ];
    feedbackInterval = setInterval(() => {
        const f = tips[Math.floor(Math.random() * tips.length)];
        // Silent update — only visually, no TTS during active speech
        const tv = document.getElementById('verba-text');
        const av = document.getElementById('verba-avatar');
        if (tv) tv.textContent = f.t;
        const exp = { neutral:'🤖', happy:'😊', listening:'👂', excited:'🚀', thinking:'🤔', proud:'😎' };
        if (av) av.textContent = exp[f.m] || '🤖';
        if (msgs) {
            const d = document.createElement('div');
            d.className = 'ai-msg';
            d.style.cssText = 'padding:0.5rem 0.8rem;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.85rem;';
            d.textContent = f.t;
            msgs.appendChild(d);
            msgs.scrollTop = msgs.scrollHeight;
        }
    }, 12000);
}

// ─── End session (global) ─────────────────────────────────────────────────────
window.endSessionManual = () => {
    clearInterval(timerInterval);
    clearInterval(feedbackInterval);
    document.body.classList.remove('focus-active', 'fever-active');
    stopVoice();
    stopWaveform();

    const dur = isChallengeMode ? (window.selectedDuration * 60 - seconds) : seconds;
    const { wordCount } = stopRecording();
    let results = completeSession(dur, wordCount, sessionFillers);

    if (isFeverMode) { results.xpGained *= 2; results.impPoints *= 2; }

    const wpm = document.getElementById('live-wpm')?.textContent || '0';
    let tip = 'Excellent work! Your speaking pace is very natural.';
    if (results.lowSpeech)        tip = 'Try to speak more continuously. Even short sentences build fluency!';
    else if (parseInt(wpm) < 50)  tip = 'Try to speak a little faster. Practice with short phrases.';
    else if (parseInt(wpm) > 140) tip = `You're speaking very fast! Add more pauses so listeners can follow.`;
    if (sessionFillers > 5)       tip += ` Also, you used ${sessionFillers} filler words — try pausing instead of saying "um".`;
    if (isFeverMode)              tip = '🔥 FEVER MODE BONUS ACTIVE! ' + tip;

    const s = id => document.getElementById(id);
    if (s('report-words'))      s('report-words').textContent      = wordCount;
    if (s('report-wpm'))        s('report-wpm').textContent        = wpm;
    if (s('report-fillers'))    s('report-fillers').textContent    = sessionFillers;
    if (s('report-suggestion')) s('report-suggestion').textContent = tip;

    if (!results.lowSpeech) playSound('sound-success');
    const modal = s('report-modal');
    if (modal) modal.style.display = 'flex';

    showToast(
        results.lowSpeech ? 'Speak More!' : 'Session Complete!',
        results.lowSpeech ? '🤫' : '🌟',
        results.lowSpeech ? 'Not enough speech for XP.' : `+${results.xpGained} XP | +${results.impPoints} Pts`
    );
};

// ─── Close report (global) ────────────────────────────────────────────────────
window.closeReport = () => {
    const m = document.getElementById('report-modal');
    if (m) m.style.display = 'none';
    if (window.location.pathname === '/practice') window.location.href = '/dashboard';
    else updateStatsUI();
};

// ─── Download report (global) ─────────────────────────────────────────────────
window.downloadSession = () => {
    const g = id => document.getElementById(id)?.textContent || '';
    const txt = `VERBA AI — SESSION REPORT\n${'─'.repeat(40)}\nDate: ${new Date().toLocaleString()}\nTopic: ${g('topic-text')}\n\nSTATS\n  Words : ${g('report-words')}\n  WPM   : ${g('report-wpm')}\n  Fillers: ${g('report-fillers')}\n\nAI SUGGESTION\n${g('report-suggestion')}\n\n${'─'.repeat(40)}\nKeep practicing — you're getting better every day!`;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: `VerbaAI_${Date.now()}.txt` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// ─── Daily challenge launcher (global) ───────────────────────────────────────
window.startDailyChallenge = () => {
    const t = document.getElementById('daily-challenge-topic')?.textContent;
    if (t) { sessionStorage.setItem('verba_challenge_topic', t); window.location.href = '/practice'; }
};

// ═══════════════════════════════════════════════════════════════
//  DOMContentLoaded — wire everything up
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    initTheme();
    updateStatsUI();
    await loadTopics();
    initSpinWheel();
    initSpeech();

    // ── Theme button ────────────────────────────────────────────────────────
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // ── Voice button ────────────────────────────────────────────────────────
    const voiceBtn = document.getElementById('voice-toggle-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            window.isVoiceEnabled = !window.isVoiceEnabled;
            voiceBtn.textContent  = window.isVoiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
            voiceBtn.style.opacity = window.isVoiceEnabled ? '1' : '0.6';
            if (!window.isVoiceEnabled) stopVoice();
        });
    }

    // ── Domain buttons ──────────────────────────────────────────────────────
    const domainBtns = document.querySelectorAll('.domain-btn');
    let activeDomain = '';
    domainBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            domainBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeDomain = btn.dataset.domain;
            setDomain(activeDomain);
        });
    });

    // ── Duration buttons ────────────────────────────────────────────────────
    const durBtns = document.querySelectorAll('.duration-btn');
    durBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            durBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.selectedDuration = parseInt(btn.dataset.mins) || 0;
        });
    });

    // ── Confirm setup ───────────────────────────────────────────────────────
    const confirmBtn = document.getElementById('setup-confirm-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (!activeDomain) { alert('Please select a domain first!'); return; }
            const sel = document.getElementById('domain-selection');
            const pa  = document.getElementById('practice-area');
            if (sel) sel.style.display = 'none';
            if (pa)  pa.style.display  = 'block';
            const ts = document.getElementById('topic-status');
            if (ts)  ts.textContent   = `Domain: ${activeDomain}`;
            const sb = document.getElementById('start-btn');
            if (sb)  sb.style.display = 'inline-block';
        });
    }

    // ── Start button ────────────────────────────────────────────────────────
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', triggerStart);

    // ── Topic reveal callback ────────────────────────────────────────────────
    window.onTopicReveal = () => {
        prepSeconds = 30;
        const sb = document.getElementById('start-btn');
        const sk = document.getElementById('skip-prep-btn');
        const td = document.getElementById('timer-display');
        if (sb) sb.style.display = 'none';
        if (sk) sk.style.display = 'inline-block';
        playSound('sound-reveal');
        updateVerba('You have 30 seconds to prepare your thoughts!', 'thinking');
        clearInterval(prepInterval);
        prepInterval = setInterval(() => {
            prepSeconds--;
            if (td) { td.textContent = `Prep: ${prepSeconds}s`; td.style.color = 'var(--accent)'; }
            if (prepSeconds <= 0) { clearInterval(prepInterval); triggerStart(); }
        }, 1000);
    };

    window.skipPrep = () => { clearInterval(prepInterval); triggerStart(); };

    // ── Daily challenge auto-start ───────────────────────────────────────────
    if (window.location.pathname === '/practice') {
        const ct = sessionStorage.getItem('verba_challenge_topic');
        if (ct) {
            const tte = document.getElementById('topic-text');
            const ds  = document.getElementById('domain-selection');
            const pa  = document.getElementById('practice-area');
            if (tte) tte.textContent = ct;
            if (ds)  ds.style.display = 'none';
            if (pa)  pa.style.display  = 'block';
            sessionStorage.removeItem('verba_challenge_topic');
            setTimeout(() => window.onTopicReveal && window.onTopicReveal(), 100);
        }
    }

    // ── Speech updates ───────────────────────────────────────────────────────
    window.addEventListener('speechUpdate', e => {
        const { transcript, wordCount } = e.detail;

        // Kill Verba voice immediately when user speaks
        userTalking = true;
        stopVoice();
        clearTimeout(talkingTimer);
        talkingTimer = setTimeout(() => {
            userTalking = false;
            // Deliver any pending message now that user has paused
            if (verbaPending) scheduleVoice(verbaPending);
        }, 1500);

        lastSpeechTime = Date.now();
        isNudging = false;
        const vb = document.getElementById('verba-persona-box');
        if (vb) vb.classList.remove('nudge');

        // Voice-activated theme
        const lower = transcript.toLowerCase();
        if ((lower.includes('change theme') || lower.includes('next theme')) && Date.now() - lastThemeCmd > 3000) {
            lastThemeCmd = Date.now();
            toggleTheme();
            updateVerba('Transforming environment!', 'excited');
        }

        // Combo meter
        if (!isFeverMode) {
            combo = Math.min(100, combo + 5);
            if (combo >= 100) {
                isFeverMode = true;
                document.body.classList.add('fever-active');
                updateVerba('FEVER MODE! 2× XP for this session!', 'excited');
                playSound('sound-success');
            }
        }
        const cb = document.getElementById('combo-bar');
        const ct = document.getElementById('combo-text');
        if (cb) cb.style.width = `${combo}%`;
        if (ct) { ct.textContent = isFeverMode ? '🔥 FEVER MODE ×2 XP 🔥' : `${combo}%`; if (isFeverMode) ct.style.color = '#facc15'; }

        const lt = document.getElementById('live-transcript');
        const lw = document.getElementById('live-word-count');
        const lm = document.getElementById('live-wpm');
        const fb = document.getElementById('fluency-badge');
        if (lt) lt.textContent = transcript || 'Listening...';
        if (lw) lw.textContent = wordCount;

        // Filler detection
        sessionFillers = (transcript.match(/\b(um|ah|uh|like|actually|basically|you know)\b/gi) || []).length;

        updateSentiment(transcript);

        // WPM
        const elapsed = isChallengeMode ? (window.selectedDuration * 60 - seconds) : seconds;
        const wpm = Math.round(wordCount / Math.max(0.01, elapsed / 60));
        if (lm) lm.textContent = wpm;
        if (fb && elapsed > 3) {
            fb.className = '';
            fb.style.cssText = 'padding:0.2rem 0.6rem;border-radius:4px;font-size:0.7rem;text-transform:uppercase;';
            if (wpm < 60)       { fb.textContent = 'Slow';    fb.style.background = '#ff4757'; fb.style.color = '#fff'; }
            else if (wpm < 120) { fb.textContent = 'Average'; fb.style.background = '#ffa502'; fb.style.color = '#000'; }
            else                { fb.textContent = 'Fluent';  fb.style.background = '#2ed573'; fb.style.color = '#000'; }
        }
    });

    window.addEventListener('speechError', e => {
        updateVerba(e.detail.message, 'thinking');
        if (e.detail.error === 'not-allowed') {
            const as = document.getElementById('ai-status');
            if (as) as.innerHTML = '<span class="status-dot" style="background:red;"></span> Mic Access Denied';
        }
    });

    // ── Level-up celebration ─────────────────────────────────────────────────
    window.addEventListener('levelUp', e => {
        if (typeof confetti !== 'undefined') {
            confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        }
        playSound('sound-levelup');
        updateVerba(`LEVEL UP! You are now Level ${e.detail.level}! 🚀`, 'excited');
        showToast('LEVEL UP!', '🏆', `You've reached Level ${e.detail.level}!`, 5000);
    });

    // ── Badge toast ──────────────────────────────────────────────────────────
    window.addEventListener('badgeUnlocked', e => {
        playSound('sound-success');
        showToast('NEW TROPHY!', e.detail.icon, `Unlocked: ${e.detail.name}`, 5000);
    });

    // ── Easter egg ───────────────────────────────────────────────────────────
    const logo = document.getElementById('app-logo');
    const egg  = document.getElementById('easter-egg-btn');
    if (logo && egg) {
        logo.addEventListener('mouseenter', () => { egg.style.opacity = '1'; });
        logo.addEventListener('mouseleave', () => { egg.style.opacity = '0'; });
        egg.addEventListener('click', async () => {
            egg.style.transform  = 'translateY(-40px) scale(2)';
            try { await fetch('/easter-egg'); } catch (e) {}
        });
    }
});
