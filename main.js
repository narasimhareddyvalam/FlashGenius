// Import other modules
import { callOpenAIAPI } from './api.js';
import { knowledgeBase, searchKnowledgeBase, loadKnowledgeBase } from './knowledgeBase.js';
import { playAudio, useWebSpeechFallback, toggleSpeechRecognition, setGenerateFlashcardsFunc } from './speechRecognition.js';
import { generateSpeech } from './api.js';
import { showModal, closeModal, showNotification, updateCardDisplay, switchTab, showSyntheticDataNotice } from './ui.js';

// DOM Elements for main.js
const useSyntheticData = document.getElementById('use-synthetic');
const inputText = document.getElementById('input-text');
const useKnowledgeBase = document.getElementById('use-kb');
const cardCount = document.getElementById('card-count');
const difficulty = document.getElementById('difficulty');
const generateBtn = document.getElementById('generate-btn');
const downloadBtn = document.getElementById('download-btn');
const shareBtn = document.getElementById('share-btn');
const audioBtn = document.getElementById('audio-btn');
const micBtn = document.getElementById('mic-btn');
const flashcardAudioBtn = document.getElementById('flashcard-audio-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const flashcard = document.querySelector('.flashcard');
const loading = document.querySelector('.loading');
const tabBtns = document.querySelectorAll('.tab-btn');

// State
let flashcards = [];
let currentCardIndex = 0;
let isGenerating = false;
let activeTab = 'input';
let isPlayingAudio = false;


// Event Listeners
generateBtn.addEventListener('click', generateFlashcards);
flashcard.addEventListener('click', toggleFlashcard);
prevBtn.addEventListener('click', showPreviousCard);
nextBtn.addEventListener('click', showNextCard);
downloadBtn.addEventListener('click', downloadFlashcards);
shareBtn.addEventListener('click', shareFlashcards);

if (audioBtn) {
    console.log("Adding listener to audio button");
    audioBtn.addEventListener('click', listenToTopicDescription);
}
if (flashcardAudioBtn) {
    console.log("Adding listener to flashcard audio button");
    flashcardAudioBtn.addEventListener('click', pronounceCurrentCard);
}
if (micBtn) {
    micBtn.addEventListener('click', toggleSpeechRecognition);
}

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        switchTab(tabName);
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    // Load knowledge base from localStorage
    loadKnowledgeBase();
    
    // Set the reference to generateFlashcards for speech recognition
    setGenerateFlashcardsFunc(generateFlashcards);
        // Set synthetic data toggle based on localStorage
    const syntheticEnabled = localStorage.getItem('synthetic-data-enabled');
    if (syntheticEnabled === 'false') {
        useSyntheticData.checked = false;
    } else {
        useSyntheticData.checked = true;
        localStorage.setItem('synthetic-data-enabled', 'true');
    }

    // Add event listener for synthetic data toggle
    useSyntheticData.addEventListener('change', () => {
        localStorage.setItem('synthetic-data-enabled', useSyntheticData.checked);
        // Update UI if needed
        if (flashcards.length > 0) {
            updateCardDisplay();
        }
    });
}

// Generate flashcards using OpenAI API with RAG
// Generate flashcards using OpenAI API with RAG
async function generateFlashcards() {
    // Get the input text
    const text = inputText.value.trim();
    
    if (!text) {
        showModal('Please enter a topic or learning material first!');
        return;
    }
    
    // Show loading state
    isGenerating = true;
    loading.classList.add('active');
    
    try {
        console.log("Starting flashcard generation for:", text);
        
        // Use OpenAI API for generating flashcards
        const requestedCount = parseInt(cardCount.value);
        const difficultyLevel = difficulty.value;
        
        console.log("Settings:", { requestedCount, difficultyLevel });
        
        // Check if knowledge base should be used
        const useKB = useKnowledgeBase.checked && knowledgeBase.length > 0;
        let contextualInfo = '';
        let citations = [];
        
        // Get relevant information from knowledge base if enabled
        if (useKB) {
            console.log("Using knowledge base for context");
            const searchResults = await searchKnowledgeBase(text);
            
            if (searchResults.length > 0) {
                console.log("Found relevant results:", searchResults.length);
                // Prepare contextual information with citations
                contextualInfo = "Here is some relevant information from your knowledge base:\n\n";
                
                searchResults.forEach((result, index) => {
                    contextualInfo += `[${index + 1}] From "${result.docTitle}": ${result.chunk}\n\n`;
                    citations.push({
                        id: index + 1,
                        title: result.docTitle,
                        text: result.chunk
                    });
                });
            }
        }
        
        // Determine if input is a topic or learning material
        const isTopic = text.split(' ').length <= 10;
        
        // Create appropriate prompt
        let prompt;
        if (isTopic) {
            prompt = createTopicPrompt(text, requestedCount, difficultyLevel, contextualInfo);
        } else {
            prompt = createMaterialPrompt(text, requestedCount, difficultyLevel, contextualInfo);
        }
        
        console.log("Sending prompt to OpenAI");
        
        // Call OpenAI API
        const cards = await callOpenAIAPI(prompt);
        console.log("Received cards from API:", cards);
        
        if (!cards) {
            console.error("Cards is null or undefined");
            throw new Error('Failed to generate flashcards. No response received.');
        }
        
        if (!Array.isArray(cards)) {
            console.error("Cards is not an array:", cards);
            throw new Error('Invalid response format. Expected an array of flashcards.');
        }
        
        if (cards.length === 0) {
            console.error("Cards array is empty");
            throw new Error('No flashcards were generated. Please try again.');
        }
        
        // Check first card structure
        console.log("First card structure:", JSON.stringify(cards[0]));
        
        if (cards[0] && typeof cards[0] === 'object') {
            // Validate card properties
            if (!cards[0].hasOwnProperty('question') || !cards[0].hasOwnProperty('answer')) {
                console.error("Card missing required properties");
                
                // Try to fix cards format if possible
                const fixedCards = cards.map(card => {
                    // Create a valid card with fallback values
                    return {
                        question: card.question || card.front || Object.keys(card)[0] || "Question not available",
                        answer: card.answer || card.back || Object.values(card)[0] || "Answer not available"
                    };
                });
                
                console.log("Fixed cards:", fixedCards);
                flashcards = fixedCards;
            } else {
                // Format looks valid
                flashcards = cards;
            }
            
            // Add citations to cards if available
            if (citations.length > 0) {
                console.log("Adding citations to cards");
                flashcards.forEach(card => {
                    // Create an array to store references for this card
                    const references = [];
                    
                    // Look for citation markers like [1] in the text
                    for (const citation of citations) {
                        const marker = `[${citation.id}]`;
                        if (card.answer && card.answer.includes(marker)) {
                            references.push({
                                title: citation.title,
                                text: citation.text
                            });
                        }
                    }
                    
                    // Add references to the card if any were found
                    if (references.length > 0) {
                        card.sources = references;
                    }
                });
            }
            
            // Limit to requested count
            if (flashcards.length > requestedCount) {
                console.log(`Limiting cards from ${flashcards.length} to ${requestedCount}`);
                flashcards = flashcards.slice(0, requestedCount);
            }
            
            console.log("Final flashcards:", flashcards);
            
            // Reset and display
            currentCardIndex = 0;
            updateCardDisplay();
        } else {
            console.error("First card is not an object:", cards[0]);
            throw new Error('Invalid card format. Please try again.');
        }
    } catch (error) {
        console.error('Error generating flashcards:', error);
        showModal('There was an error generating your flashcards: ' + error.message);
    } finally {
        // Hide loading state
        isGenerating = false;
        loading.classList.remove('active');
    }
}

// Synthetic data generation functions
function generateVariations(card, variationCount = 3) {
    // Create a prompt for generating variations
    const prompt = `
    Create ${variationCount} variations of this flashcard with slightly different wording or perspective.
    Original Question: "${card.question}"
    Original Answer: "${card.answer}"
    
    Return ONLY a JSON array with each variation having "question" and "answer" fields.
    `;
    
    // Use the existing OpenAI API call
    return callOpenAIAPI(prompt)
        .then(variationCards => {
            return variationCards;
        })
        .catch(error => {
            console.error('Error generating variations:', error);
            return [];
        });
}

function generateSyntheticExamples(concept, count = 2) {
    console.log("Generating detailed examples for:", concept);
    
    // Force uniqueness by adding a timestamp to the prompt
    const timestamp = new Date().getTime();
    
    // Create an enhanced prompt that requests more specific examples
    const prompt = `
    UNIQUE REQUEST ID: ${timestamp}
    
    Create a comprehensive educational resource about "${concept}" with these TWO components:
    
    1. EXAMPLES (array of objects):
       Generate exactly ${Math.max(count, 2)} specific, detailed real-world examples that demonstrate "${concept}" in action.
       Each example must have:
       - A descriptive title that includes "${concept}" in context
       - A thorough, informative explanation (4-5 sentences) that explains how "${concept}" applies in this specific scenario
       - Use concrete details and facts
       - Each example must be from a different field or industry
    
    2. VISUALIZATION (flowchart):
       Create a simple but informative flowchart explaining "${concept}" visually.
       Requirements:
       - 4-6 clearly labeled nodes
       - Logical relationships between components
       - Show how "${concept}" works or is applied
       - Simple enough to understand at a glance
    
    Format your response as a JSON object with:
    - "examples": Array of objects with "scenario" and "explanation" fields
    - "visualization": String containing Mermaid.js flowchart code (using graph TD syntax)
    
    Format example:
    {
      "examples": [
        {"scenario": "Specific Title About ${concept}", "explanation": "Detailed explanation with facts..."},
        {"scenario": "Another Title With ${concept}", "explanation": "Another detailed explanation..."}
      ],
      "visualization": "graph TD\\nA[${concept}] --> B[Specific Application]\\nA --> C[Concrete Benefit]\\nB --> D[Real Example]\\nC --> E[Measurable Outcome]"
    }
    `;
    
    // Enhanced fallbacks that are more specific and detailed
    const enhancedFallbacks = [
        {
            "scenario": `${concept} in Healthcare Systems`,
            "explanation": `In modern healthcare settings, ${concept} is systematically applied to improve patient outcomes through evidence-based protocols. For example, Mayo Clinic implemented ${concept} when developing treatment guidelines for complex cardiology cases, resulting in a 23% improvement in recovery rates. This methodical approach helps standardize care across different facilities while still enabling physicians to personalize treatment based on individual patient factors.`
        },
        {
            "scenario": `${concept} in Technology Product Development`,
            "explanation": `Leading technology companies like Google and Microsoft implement ${concept} throughout their development lifecycle. For instance, when creating user interfaces, product teams use ${concept} to analyze behavioral patterns and create intuitive interaction models. This structured approach has been credited with reducing user learning curves by up to 40% and increasing customer satisfaction scores by 28% in recent product launches.`
        },
        {
            "scenario": `${concept} in Educational Curriculum Design`,
            "explanation": `Educational institutions have transformed learning outcomes by applying ${concept} to curriculum development. The Khan Academy team, for example, uses ${concept} to structure their online learning modules, carefully sequencing concepts from fundamental to advanced. This methodology has demonstrably increased student comprehension by adapting to different learning styles and providing consistent knowledge scaffolding for complex topics.`
        }
    ];
    
    const enhancedVisualization = `graph TD
        A[${concept}] --> B[Practical Application]
        A --> C[Key Benefits]
        B --> D[Real-World Example]
        C --> E[Measurable Outcome 1]
        C --> F[Measurable Outcome 2]`;
    
    // Call OpenAI API with the enhanced prompt
    return callOpenAIAPI(prompt)
        .then(response => {
            console.log(`Raw API response for "${concept}":`, response);
            
            // Initialize with fallbacks
            let examples = [];
            let visualization = enhancedVisualization;
            
            // Process response if valid
            if (response && typeof response === 'object') {
                // Extract examples if available in expected format
                if (response.examples && Array.isArray(response.examples) && response.examples.length > 0) {
                    examples = response.examples.filter(ex => 
                        ex && typeof ex === 'object' && 
                        ex.scenario && typeof ex.scenario === 'string' && 
                        ex.explanation && typeof ex.explanation === 'string'
                    );
                } 
                // Try to handle if API returned just an array
                else if (Array.isArray(response) && response.length > 0) {
                    examples = response.filter(ex => 
                        ex && typeof ex === 'object' && 
                        (ex.scenario || ex.title) && 
                        (ex.explanation || ex.content)
                    ).map(ex => ({
                        scenario: ex.scenario || ex.title,
                        explanation: ex.explanation || ex.content
                    }));
                }
                
                // Extract visualization if available
                if (response.visualization && typeof response.visualization === 'string') {
                    // Clean up the visualization code to ensure it works with Mermaid
                    let cleanViz = response.visualization
                        .replace(/\\n/g, '\n')  // Replace literal \n with actual newlines
                        .replace(/;$/, '');     // Remove trailing semicolon if present
                    
                    if (!cleanViz.startsWith('graph TD')) {
                        cleanViz = 'graph TD\n' + cleanViz;
                    }
                    
                    visualization = cleanViz;
                }
            }
            
            // Use fallbacks if needed
            if (!examples || examples.length === 0) {
                console.log(`Using fallback examples for "${concept}"`);
                examples = enhancedFallbacks;
            }
            
            // Ensure we have at least the requested number of examples
            while (examples.length < Math.max(count, 2)) {
                examples.push(enhancedFallbacks[examples.length % enhancedFallbacks.length]);
            }
            
            // Return the processed results
            return {
                examples: examples.slice(0, Math.max(count, 2)),
                visualization: visualization
            };
        })
        .catch(error => {
            console.error(`Error generating content for "${concept}":`, error);
            // Return enhanced fallbacks on error
            return {
                examples: enhancedFallbacks.slice(0, Math.max(count, 2)),
                visualization: enhancedVisualization
            };
        });
}

function generateProgressiveDifficulty(masteredCard, nextLevel) {
    const levels = ['basic', 'intermediate', 'advanced', 'expert'];
    const targetLevel = levels[Math.min(levels.indexOf(nextLevel), levels.length - 1)];
    
    const prompt = `
    The user has mastered this flashcard:
    Question: "${masteredCard.question}"
    Answer: "${masteredCard.answer}"
    
    Create a more challenging version at the ${targetLevel} difficulty level that builds on this knowledge.
    The new question should require deeper understanding or application of the same concept.
    
    Return ONLY a JSON object with "question" and "answer" fields.
    `;
    
    return callOpenAIAPI(prompt)
        .then(challengeCards => {
            return challengeCards[0] || null;
        });
}

// Function to read the topic description
function listenToTopicDescription() {
    const text = inputText.value.trim();
    
    if (!text) {
        showModal('Please enter a topic or learning material first!');
        return;
    }
    
    // If audio is already playing, stop it
    if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        isPlayingAudio = false;
        audioBtn.classList.remove('audio-playing');
        audioBtn.classList.remove('audio-loading');
        return;
    }
    
    // Show loading state
    audioBtn.classList.add('audio-playing');
    audioBtn.classList.add('audio-loading');
    isPlayingAudio = true;
    
    // Try ElevenLabs first for Bella's voice
    generateSpeech(text)
        .then(audioUrl => {
            // Remove loading state, keep playing state
            audioBtn.classList.remove('audio-loading');
            
            // Play the audio
            playAudio(audioUrl, audioBtn);
            console.log("Using ElevenLabs voice");
        })
        .catch(error => {
            console.error('ElevenLabs Speech generation error:', error);
            
            // Fallback to Web Speech API if ElevenLabs fails
            if ('speechSynthesis' in window) {
                console.log("Falling back to Web Speech API");
                
                // Use Web Speech API as fallback
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.onstart = function() {
                    audioBtn.classList.remove('audio-loading');
                };
                utterance.onend = function() {
                    audioBtn.classList.remove('audio-playing');
                    isPlayingAudio = false;
                };
                utterance.onerror = function() {
                    audioBtn.classList.remove('audio-playing');
                    audioBtn.classList.remove('audio-loading');
                    isPlayingAudio = false;
                };
                window.speechSynthesis.speak(utterance);
            } else {
                audioBtn.classList.remove('audio-loading');
                audioBtn.classList.remove('audio-playing');
                isPlayingAudio = false;
                showModal('There was an error generating the audio. Please try again.');
            }
        });
}

// Pronounce the current flashcard (prioritizing ElevenLabs)
function pronounceCurrentCard() {
    if (flashcards.length === 0) return;
    
    // If audio is already playing, stop it
    if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        isPlayingAudio = false;
        flashcardAudioBtn.classList.remove('audio-playing');
        flashcardAudioBtn.classList.remove('audio-loading');
        return;
    }
    
    const currentCard = flashcards[currentCardIndex];
    const textToSpeak = flashcard.classList.contains('flipped') ? 
        currentCard.answer : currentCard.question;
    
    // Show loading state
    flashcardAudioBtn.classList.add('audio-playing');
    flashcardAudioBtn.classList.add('audio-loading');
    isPlayingAudio = true;
    
    // Try ElevenLabs first for Bella's voice
    generateSpeech(textToSpeak)
        .then(audioUrl => {
            // Remove loading state, keep playing state
            flashcardAudioBtn.classList.remove('audio-loading');
            
            // Play the audio
            playAudio(audioUrl, flashcardAudioBtn);
            console.log("Using ElevenLabs voice for flashcard");
        })
        .catch(error => {
            console.error('ElevenLabs Speech generation error:', error);
            
            // Fallback to Web Speech API if ElevenLabs fails
            if ('speechSynthesis' in window) {
                console.log("Falling back to Web Speech API for flashcard");
                
                // Use Web Speech API as fallback
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.onstart = function() {
                    flashcardAudioBtn.classList.remove('audio-loading');
                };
                utterance.onend = function() {
                    flashcardAudioBtn.classList.remove('audio-playing');
                    isPlayingAudio = false;
                };
                utterance.onerror = function() {
                    flashcardAudioBtn.classList.remove('audio-playing');
                    flashcardAudioBtn.classList.remove('audio-loading');
                    isPlayingAudio = false;
                };
                window.speechSynthesis.speak(utterance);
            } else {
                flashcardAudioBtn.classList.remove('audio-loading');
                flashcardAudioBtn.classList.remove('audio-playing');
                isPlayingAudio = false;
                showModal('There was an error generating the audio. Please try again.');
            }
        });
}

// Toggle flashcard flip
function toggleFlashcard() {
    flashcard.classList.toggle('flipped');
}

// Show previous card
function showPreviousCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        updateCardDisplay();
    }
}

// Show next card
function showNextCard() {
    if (currentCardIndex < flashcards.length - 1) {
        currentCardIndex++;
        updateCardDisplay();
    }
}

// Download flashcards as a text file
function downloadFlashcards() {
    if (flashcards.length === 0) {
        showModal('No flashcards to download!');
        return;
    }
    
    // Create text content for the file
    let fileContent = "FlashGenius Flashcards\n";
    fileContent += "====================\n\n";
    
    // Add date and time
    fileContent += `Created: ${new Date().toLocaleString()}\n`;
    fileContent += `Number of cards: ${flashcards.length}\n`;
    fileContent += `Difficulty level: ${difficulty.value}\n\n`;
    
    // Add all flashcards
    flashcards.forEach((card, index) => {
        fileContent += `Card ${index + 1}:\n`;
        fileContent += `Q: ${card.question}\n`;
        fileContent += `A: ${card.answer}\n`;
        
        // Add sources if available
        if (card.sources && card.sources.length > 0) {
            fileContent += `Sources:\n`;
            card.sources.forEach(source => {
                fileContent += `- ${source.title}\n`;
            });
        }
        
        fileContent += '\n';
    });
    
    // Create a blob object from the text content
    const blob = new Blob([fileContent], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'flashcards.txt';
    
    // Append to the document, click it, and remove it
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Show save notification
    showNotification('Flashcards downloaded successfully!');
}

// Share flashcards (simplified for demo)
function shareFlashcards() {
    if (flashcards.length === 0) {
        showModal('No flashcards to share!');
        return;
    }
    
    // In a real app, you might implement sharing via URL, email, etc.
    // For this demo, we'll just prepare a text version for copying
    
    let shareText = "My FlashGenius Flashcards:\n\n";
    
    flashcards.forEach((card, index) => {
        shareText += `Card ${index + 1}:\n`;
        shareText += `Q: ${card.question}\n`;
        shareText += `A: ${card.answer}\n\n`;
    });
    
    // Create a temporary textarea to copy the text
    const textarea = document.createElement('textarea');
    textarea.value = shareText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    showNotification('Flashcards copied to clipboard!');
}

// Create prompt for topic-based generation
function createTopicPrompt(topic, count, difficulty, contextualInfo = '') {
    let prompt = `
Generate ${count} high-quality flashcards about "${topic}" at ${difficulty} difficulty level.

The flashcards should be designed for effective learning, with clear questions and comprehensive answers.

For ${difficulty} difficulty level:
${difficultyGuidelines(difficulty)}
`;

    // Add contextual information if available
    if (contextualInfo) {
        prompt += `\n\nPlease use the following information to create accurate flashcards. Include citation markers [1], [2], etc. where appropriate in your answers:\n\n${contextualInfo}`;
    }

    prompt += `
Format your response as a JSON array of flashcard objects, with each object having "question" and "answer" fields.
Example format:
[
  {"question": "What is the capital of France?", "answer": "Paris is the capital of France."},
  {"question": "What is the formula for the area of a circle?", "answer": "The formula for the area of a circle is A = πr², where r is the radius. [1]"}
]

Return ONLY the JSON array without any additional text, explanation, or formatting.
`;

    return prompt;
}

// Create prompt for material-based generation
function createMaterialPrompt(material, count, difficulty, contextualInfo = '') {
    let prompt = `
Generate ${count} high-quality flashcards based on the following learning material, at ${difficulty} difficulty level.

Learning Material:
${material.substring(0, 6000)} ${material.length > 6000 ? '... (material truncated for length)' : ''}

The flashcards should cover the key concepts and important information from the material.

For ${difficulty} difficulty level:
${difficultyGuidelines(difficulty)}
`;

    // Add contextual information if available
    if (contextualInfo) {
        prompt += `\n\nPlease also consider the following additional information from my knowledge base. Include citation markers [1], [2], etc. where appropriate in your answers:\n\n${contextualInfo}`;
    }

    prompt += `
Format your response as a JSON array of flashcard objects, with each object having "question" and "answer" fields.
Example format:
[
  {"question": "What is the main concept described in paragraph 2?", "answer": "The text explains that..."},
  {"question": "How does the author define X?", "answer": "According to the material, X is defined as... [1]"}
]

Return ONLY the JSON array without any additional text, explanation, or formatting.
`;

    return prompt;
}

// Get difficulty-specific guidelines
function difficultyGuidelines(difficulty) {
    switch (difficulty) {
        case 'basic':
            return '- Focus on fundamental concepts and definitions\n- Use straightforward language\n- Questions should test recognition and recall\n- Answers should be concise and direct';
        
        case 'intermediate':
            return '- Cover both basic and more complex concepts\n- Include some application of knowledge\n- Questions may require some analysis\n- Answers should provide clear explanations with moderate detail';
            
        case 'advanced':
            return '- Focus on complex concepts and their relationships\n- Include application, analysis, and evaluation\n- Questions should challenge deeper understanding\n- Answers should be comprehensive with nuanced explanations\n- Include examples and counterexamples where appropriate';
            
        default:
            return '- Balance foundational knowledge with deeper concepts\n- Include a mix of recall and application questions\n- Answers should be informative and educational';
    }
}

// Export necessary functions
export { 
    flashcards, 
    currentCardIndex, 
    isGenerating,
    isPlayingAudio,
    activeTab,
    generateFlashcards,
    createTopicPrompt,
    createMaterialPrompt,
    generateVariations,
    generateSyntheticExamples,
    generateProgressiveDifficulty
};