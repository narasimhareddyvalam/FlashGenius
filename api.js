// API Keys
const OPENAI_API_KEY = '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'; // Replace with your actual OpenAI API key
const ELEVEN_LABS_API_KEY = 'sk_5438bbcde7e5c90a385203c955903123dc9df3756ac0e639'; // Replace with your actual Eleven Labs API key
const ELEVEN_LABS_VOICE_ID = 'AZnzlk1XvdvUeBnXmlld'; // Bella voice ID

import { useWebSpeechFallback } from './speechRecognition.js';

// Call OpenAI API
async function callOpenAIAPI(prompt) {
    try {
        // Add this line for debugging
        console.log('API Key defined:', Boolean(OPENAI_API_KEY));
        console.log('API Key first 5 chars:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 5) : 'undefined');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are an educational assistant that creates high-quality flashcards. You always respond with properly formatted JSON arrays of flashcard objects."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000,
                response_format: { type: "json_object" }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'API error');
        }
        
        // Parse the response to get flashcards
        const responseText = data.choices[0].message.content.trim();
        
        // Try to parse the JSON response
        try {
            const parsedData = JSON.parse(responseText);
            
            // Handle different possible formats
            if (Array.isArray(parsedData)) {
                return parsedData.map(card => ({
                    question: card.question || "Question not provided",
                    answer: card.answer || "Answer not provided"
                }));
            } else if (parsedData.flashcards && Array.isArray(parsedData.flashcards)) {
                return parsedData.flashcards.map(card => ({
                    question: card.question || "Question not provided",
                    answer: card.answer || "Answer not provided"
                }));
            } else {
                // If structure is unexpected, try to extract question-answer pairs
                return Object.entries(parsedData).map(([key, value]) => ({
                    question: key,
                    answer: typeof value === 'string' ? value : JSON.stringify(value)
                }));
            }
        } catch (e) {
            console.error("JSON parse error:", e, responseText);
            
            // Try to extract JSON if wrapped in other text
            const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error("Second JSON parse error:", e2);
                    throw new Error('Failed to parse API response');
                }
            } else {
                throw new Error('Could not extract JSON from response');
            }
        }
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw error;
    }
}

// Function to generate speech using Eleven Labs API - fixed function closure
async function generateSpeech(text) {
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVEN_LABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Eleven Labs API error: ${errorData.detail || response.statusText}`);
        }
        
        // Get the audio blob
        const audioBlob = await response.blob();
        
        // Create a URL for the blob
        return URL.createObjectURL(audioBlob);
    } catch (error) {
        console.error('Speech generation error:', error);
        throw error; // Let calling function handle the fallback
    }    
}

export {
    ELEVEN_LABS_VOICE_ID,
    callOpenAIAPI,
    generateSpeech
};