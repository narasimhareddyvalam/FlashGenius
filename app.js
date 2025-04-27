// Import all functionality from modules
import * as api from './api.js';
import * as kb from './knowledgeBase.js';
import * as speech from './speechRecognition.js';
import * as ui from './ui.js';
import * as main from './main.js';


// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App initialized!");

    kb.initKnowledgeBase(); // ✅ if kb.js is imported correctly
});
