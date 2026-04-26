// static/js/spin.js
import { getRandomTopic } from './topic.js';

let isSpinning = false;
let totalDeg   = 0;   // cumulative rotation so reset never jumps visibly

export function initSpinWheel() {
    const spinBtn    = document.getElementById('spin-btn');
    const topicText  = document.getElementById('topic-text');
    const wheel      = document.getElementById('wheel-element');
    const topicStatus = document.getElementById('topic-status');
    const topicCard  = document.getElementById('topic-container');

    if (!spinBtn || !wheel) return;

    spinBtn.addEventListener('click', () => {
        if (isSpinning) return;

        const topic = getRandomTopic();
        if (!topic || topic.startsWith('Please select')) {
            alert('Please select a domain first, then spin!');
            return;
        }

        isSpinning = true;
        spinBtn.disabled  = true;
        spinBtn.textContent = '🌀 Spinning...';
        if (topicStatus) topicStatus.textContent = 'Choosing your topic…';

        // Add random extra rotations (5–10 full turns)
        const extra = (5 + Math.random() * 5) * 360;
        totalDeg += extra;

        wheel.style.transition = 'transform 3s cubic-bezier(0.15, 0, 0.15, 1)';
        wheel.style.transform  = `rotate(${totalDeg}deg)`;

        setTimeout(() => {
            // Reveal topic
            if (topicText) {
                topicText.style.opacity = '0';
                setTimeout(() => {
                    topicText.textContent   = topic;
                    topicText.style.opacity = '1';
                }, 200);
            }
            if (topicStatus) topicStatus.textContent = '✅ Topic Selected!';

            // Restart card animation
            if (topicCard) {
                topicCard.classList.remove('reveal-anim');
                void topicCard.offsetWidth;
                topicCard.classList.add('reveal-anim');
            }

            // Notify main.js to begin prep countdown
            if (typeof window.onTopicReveal === 'function') {
                window.onTopicReveal();
            }

            isSpinning          = false;
            spinBtn.disabled    = false;
            spinBtn.textContent = '🎲 Spin Again';
        }, 3200);
    });
}
