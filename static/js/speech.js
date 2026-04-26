// static/js/speech.js

let recognition;
let transcript = "";
let wordCount = 0;

export function initSpeech() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        console.error("Speech Recognition not supported in this browser.");
        return;
    }

    recognition = new window.SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
        }
        transcript = currentTranscript;
        wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
        
        // Custom event to update UI in real-time (Phase 2 preview)
        window.dispatchEvent(new CustomEvent('speechUpdate', { detail: { transcript, wordCount } }));
    };

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        
        let userMessage = "Hmm, something went wrong with the microphone.";
        if (event.error === 'not-allowed') {
            userMessage = "Microphone access is denied! Please enable it in your browser settings to continue.";
        } else if (event.error === 'no-speech') {
            userMessage = "I didn't catch that. Make sure your mic is working and try again!";
        } else if (event.error === 'network') {
            userMessage = "It looks like there's a network issue. Speech recognition requires an internet connection.";
        }

        window.dispatchEvent(new CustomEvent('speechError', { 
            detail: { error: event.error, message: userMessage } 
        }));
    };
}

export function startRecording(lang = 'en-US') {
    transcript = "";
    wordCount = 0;
    try {
        recognition.lang = lang;
        recognition.start();
        console.log(`Mic started (Lang: ${lang})...`);
    } catch (e) {
        console.warn("Recognition already started or error:", e);
    }
}

export function stopRecording() {
    try {
        recognition.stop();
        console.log("Mic stopped.");
    } catch (e) {
        console.error("Stop error:", e);
    }
    return { transcript, wordCount };
}

export function getLiveWordCount() {
    return wordCount;
}
