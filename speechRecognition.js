import { switchTab } from './ui.js';
import { showModal } from './ui.js';
import { generateSpeech } from './api.js';

// DOM Elements
const micBtn = document.getElementById('mic-btn');
const inputText = document.getElementById('input-text');
const speechNotification = document.querySelector('.speech-notification');
const speechStatus = document.getElementById('speech-status');

// State
let isListening = false;
let isPlayingAudio = false;
let recognition = null;
let generateFlashcardsFunc = null;
let recognitionTimeout = null;

// Function to set the reference to generateFlashcards from main.js
export function setGenerateFlashcardsFunc(func) {
    generateFlashcardsFunc = func;
}

// Speech Recognition Functions
function toggleSpeechRecognition() {
    if (!isListening) {
        startSpeechRecognition();
    } else {
        stopSpeechRecognition();
    }
}

function startSpeechRecognition() {
    // Check browser support before proceeding
    if (!checkBrowserSupport()) {
        return;
    }
    
    // Make sure the input tab is active
    switchTab('input');
    
    // Show the speech notification immediately for better UX
    speechNotification.classList.add('show');
    speechStatus.textContent = "Initializing...";
    
    try {
        // Clean up any existing recognition instance
        if (recognition) {
            try {
                recognition.abort();
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onresult = null;
                recognition.onstart = null;
            } catch (e) {
                console.error("Error cleaning up recognition", e);
            }
            recognition = null;
        }
        
        // Create a fresh recognition instance
        recognition = createRecognitionInstance();
        
        // Set a timeout in case recognition doesn't start properly
        recognitionTimeout = setTimeout(() => {
            if (isListening && !recognition.recognizing) {
                console.log("Recognition timeout - forcing restart");
                stopSpeechRecognition();
                setTimeout(() => {
                    startSpeechRecognition();
                }, 500);
            }
        }, 5000);
        
        // Start recognition
        recognition.start();
        console.log("Speech recognition started");
    } 
    catch (error) {
        console.error('Error initializing speech recognition:', error);
        showModal('There was an error starting speech recognition. Please refresh the page and try again.');
        stopSpeechRecognition();
    }
}

// Create and configure a recognition instance
function createRecognitionInstance() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const instance = new SpeechRecognition();
    
    // Basic configuration
    instance.lang = 'en-US';
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    
    // Add a custom flag to track recognition state
    instance.recognizing = false;
    
    // Set up event handlers
    instance.onstart = function() {
        isListening = true;
        instance.recognizing = true;
        micBtn.classList.add('mic-active');
        speechStatus.textContent = "Listening...";
        console.log("Recognition onstart fired");
        
        // Clear the timeout since recognition started successfully
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        }
    };
    
    instance.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log("Got result:", transcript);
        inputText.value = transcript;
        speechStatus.textContent = "Processing...";
        
        // Add a small delay to provide feedback
        setTimeout(() => {
            // Speak confirmation
            speakConfirmation(transcript);
        }, 500);
    };
    
    instance.onend = function() {
        console.log("Recognition ended naturally");
        instance.recognizing = false;
        stopSpeechRecognition();
    };
    
    instance.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        instance.recognizing = false;
        
        switch(event.error) {
            case 'no-speech':
                speechStatus.textContent = "No speech detected";
                break;
            case 'aborted':
                speechStatus.textContent = "Listening canceled";
                break;
            case 'audio-capture':
                showModal('No microphone detected. Please check your device settings.');
                break;
            case 'not-allowed':
                showModal('Microphone permission denied. Please allow microphone access in your browser settings.');
                break;
            case 'service-not-allowed':
                showModal('Speech recognition service not allowed. Please try a different browser.');
                break;
            case 'language-not-supported':
                console.log("Language not supported, trying again with en-US");
                // If we get this error even with en-US, we should try a different approach
                instance.lang = 'en-US';
                setTimeout(() => {
                    try {
                        instance.start();
                    } catch (e) {
                        console.error("Error restarting with en-US", e);
                        showModal('Speech recognition is not working properly. Please try using Chrome or Edge browser.');
                        stopSpeechRecognition();
                    }
                }, 100);
                return; // Don't stop recognition yet
            default:
                showModal('Speech recognition is experiencing issues. Please try again later.');
                break;
        }
        
        // For errors that aren't recoverable, stop recognition
        if (event.error !== 'language-not-supported') {
            setTimeout(() => {
                stopSpeechRecognition();
            }, 2000);
        }
    };
    
    return instance;
}

function checkBrowserSupport() {
    // Check if the browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showModal('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
        return false;
    }
    return true;
}

function stopSpeechRecognition() {
    // Clear any pending timeout
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
    }
    
    if (recognition) {
        try {
            recognition.abort();
        } catch (e) {
            console.error("Error aborting recognition", e);
        }
        recognition = null;
    }
    
    isListening = false;
    micBtn.classList.remove('mic-active');
    
    // Hide speech notification after a delay
    setTimeout(() => {
        speechNotification.classList.remove('show');
    }, 1000);
}

function speakConfirmation(transcript) {
    if (isPlayingAudio) return;
    
    // If the transcript is empty, don't proceed
    if (!transcript.trim()) {
        stopSpeechRecognition();
        return;
    }
    
    // Create a confirmation message
    const confirmationMessage = `Generating flashcards for ${transcript}`;
    
    // Show status
    speechStatus.textContent = "Confirmed!";
    
    // Generate and play the confirmation audio
    isPlayingAudio = true;
    
    // Try using Web Speech API directly for confirmation since it's more reliable
    useWebSpeechFallback(confirmationMessage, null, true);
    
    // As a fallback, if Web Speech API doesn't work, still generate flashcards
    setTimeout(() => {
        if (isPlayingAudio) {
            isPlayingAudio = false;
            stopSpeechRecognition();
            if (generateFlashcardsFunc) {
                generateFlashcardsFunc();
            }
        }
    }, 3000);
}

// Function to play audio
function playAudio(audioUrl, buttonElement) {
    // Create an audio element
    const audio = new Audio(audioUrl);
    
    // Set up event handlers
    audio.onplay = function() {
        if (buttonElement) {
            buttonElement.classList.add('audio-playing');
        }
    };
    
    audio.onended = function() {
        if (buttonElement) {
            buttonElement.classList.remove('audio-playing');
        }
        isPlayingAudio = false;
        // Clean up the URL to prevent memory leaks
        URL.revokeObjectURL(audioUrl);
    };
    
    audio.onerror = function(event) {
        console.error('Audio playback error:', event);
        if (buttonElement) {
            buttonElement.classList.remove('audio-playing');
        }
        isPlayingAudio = false;
        showModal('There was an error playing the audio.');
        // Clean up the URL
        URL.revokeObjectURL(audioUrl);
    };
    
    // Play the audio
    audio.play().catch(error => {
        console.error('Audio play error:', error);
        if (buttonElement) {
            buttonElement.classList.remove('audio-playing');
        }
        isPlayingAudio = false;
    });
}

// Fallback to Web Speech API if Eleven Labs fails
function useWebSpeechFallback(text, buttonElement, shouldGenerateCards = false) {
    // Check if the Web Speech API is supported
    if ('speechSynthesis' in window) {
        console.log("Using Web Speech API for:", text.substring(0, 30) + "...");
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create a new speech synthesis utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set the text and voice options
        utterance.rate = 1.0;  // Speed
        utterance.pitch = 1.0; // Pitch
        utterance.lang = 'en-US'; // Force English
        
        // Add visual feedback when speaking starts
        utterance.onstart = function() {
            console.log("Speech synthesis started");
            if (buttonElement) {
                buttonElement.classList.add('audio-playing');
            }
            isPlayingAudio = true;
        };
        
        // Remove visual feedback when speaking ends
        utterance.onend = function() {
            console.log("Speech synthesis ended");
            if (buttonElement) {
                buttonElement.classList.remove('audio-playing');
                buttonElement.classList.remove('audio-loading');
            }
            isPlayingAudio = false;
            
            // If this is a confirmation, generate flashcards after speaking
            if (shouldGenerateCards && generateFlashcardsFunc) {
                stopSpeechRecognition();
                setTimeout(() => {
                    generateFlashcardsFunc();
                }, 500);
            }
        };
        
        utterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            if (buttonElement) {
                buttonElement.classList.remove('audio-playing');
                buttonElement.classList.remove('audio-loading');
            }
            isPlayingAudio = false;
            
            // If this is a confirmation, still generate flashcards even if speaking fails
            if (shouldGenerateCards && generateFlashcardsFunc) {
                stopSpeechRecognition();
                setTimeout(() => {
                    generateFlashcardsFunc();
                }, 500);
            }
        };
        
        // Try to find a voice
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en-'));
            if (englishVoices.length > 0) {
                utterance.voice = englishVoices[0];
                console.log("Using voice:", englishVoices[0].name);
            }
        } else {
            // Voices might not be loaded yet, wait for them
            window.speechSynthesis.onvoiceschanged = function() {
                const voices = window.speechSynthesis.getVoices();
                const englishVoices = voices.filter(voice => voice.lang.startsWith('en-'));
                if (englishVoices.length > 0) {
                    utterance.voice = englishVoices[0];
                    console.log("Using voice (after loading):", englishVoices[0].name);
                }
            };
        }
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
        console.log("Speech synthesis requested");
        
        // Handle Chrome bug where onend doesn't fire
        setTimeout(() => {
            if (isPlayingAudio && buttonElement) {
                console.log("Speech synthesis timeout check");
                if (!window.speechSynthesis.speaking) {
                    console.log("Speech synthesis ended (timeout)");
                    buttonElement.classList.remove('audio-playing');
                    buttonElement.classList.remove('audio-loading');
                    isPlayingAudio = false;
                }
            }
        }, text.length * 50 + 3000); // Estimate based on text length
        
        return true;
    }
    
    // Web Speech API not supported
    console.log("Web Speech API not supported");
    return false;
}

export {
    isListening,
    isPlayingAudio,
    toggleSpeechRecognition,
    playAudio,
    useWebSpeechFallback
};