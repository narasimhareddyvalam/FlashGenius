import { showModal, showNotification } from './ui.js';

// State
let knowledgeBase = [];
let isModelLoaded = false;
let sentenceEncoder = null;

// DOM Elements
const kbFileUpload = document.getElementById('kb-file-upload');
const kbFileName = document.getElementById('kb-file-name');
const kbDocTitle = document.getElementById('kb-doc-title');
const kbCount = document.getElementById('kb-count');
const kbDocuments = document.getElementById('kb-documents');
const kbLoading = document.getElementById('kb-loading');

// Initialize the knowledge base
// Initialize the knowledge base
async function initKnowledgeBase() {
    try {
        sentenceEncoder = await use.load();
        isModelLoaded = true;
        console.log('Universal Sentence Encoder loaded successfully');
    } catch (error) {
        console.error('Error loading Universal Sentence Encoder:', error);
    }
    
    // Load knowledge base from localStorage
    loadKnowledgeBase();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('kb-add-btn').addEventListener('click', addToKnowledgeBase);
    kbFileUpload.addEventListener('change', handleKbFileUpload);
});


// Handle knowledge base file upload
function handleKbFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    if (file.type !== 'text/plain' && file.type !== 'application/pdf') {
        showModal('Please upload a .txt or .pdf file only.');
        kbFileUpload.value = '';
        kbFileName.textContent = 'No file selected';
        return;
    }
    
    kbFileName.textContent = file.name;
    
    // Default to file name if title field is empty
    if (!kbDocTitle.value) {
        kbDocTitle.value = file.name.replace(/\.\w+$/, '');
    }
}

// Add document to knowledge base
async function addToKnowledgeBase() {
    const file = kbFileUpload.files[0];
    if (!file) {
        showModal('Please select a file to add to your knowledge base.');
        return;
    }
    
    // Check file type again
    if (file.type !== 'text/plain' && file.type !== 'application/pdf') {
        showModal('Please upload a .txt or .pdf file only.');
        return;
    }
    
    // Show loading state
    kbLoading.classList.remove('hidden');
    
    try {
        // Read the file content
        const content = await readFileContent(file);
        if (!content) {
            throw new Error('Unable to read file content');
        }
        
        // Get document title (use file name if not provided)
        const title = kbDocTitle.value.trim() || file.name.replace(/\.\w+$/, '');
        
        // Generate a unique ID
        const docId = 'doc_' + Date.now();
        
        // Process content into chunks
        const chunks = chunkDocument(content);
        
        // Check if model is loaded
        if (!isModelLoaded) {
            try {
                sentenceEncoder = await use.load();
                isModelLoaded = true;
                console.log('Universal Sentence Encoder loaded successfully');
            } catch (error) {
                console.error('Error loading Universal Sentence Encoder:', error);
                throw new Error('Failed to load embedding model');
            }
        }
        
        // Generate embeddings for each chunk
        const embeddings = await generateEmbeddings(chunks);
        
        // Create document object
        const document = {
            id: docId,
            title: title,
            date: new Date().toISOString(),
            chunks: chunks.map((chunk, index) => ({
                text: chunk,
                embedding: Array.from(embeddings[index])
            }))
        };
        
        // Add to knowledge base
        knowledgeBase.push(document);
        
        // Save to localStorage
        saveKnowledgeBase();
        
        // Update the display
        updateKnowledgeBaseDisplay();
        
        // Reset inputs
        kbFileUpload.value = '';
        kbFileName.textContent = 'No file selected';
        kbDocTitle.value = '';
        
        // Show success notification
        showNotification('Document added to knowledge base!');
        
    } catch (error) {
        console.error('Error adding document to knowledge base:', error);
        showModal('Error: ' + error.message);
    } finally {
        // Hide loading state
        kbLoading.classList.add('hidden');
    }
}

// Read file content
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        // Handle text files
        if (file.type === 'text/plain') {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = function(e) {
                reject(new Error('Error reading file'));
            };
            
            reader.readAsText(file);
        } else if (file.type === 'application/pdf') {
            // For PDF files in demo
            resolve(`Content extracted from PDF: ${file.name}

This is a placeholder for PDF content. In a full implementation, we would use a PDF parsing library.

For this demo, the system will create embeddings for this placeholder text to demonstrate the RAG functionality.
            
For best results with the knowledge library feature, consider using .txt files or copy-paste text content directly.`);
        } else {
            reject(new Error('Unsupported file type. Please use .txt or .pdf files.'));
        }
    });
}

// Chunk document into meaningful segments
function chunkDocument(content) {
    // Simple paragraph-based chunking
    const paragraphs = content.split(/\n\s*\n/);
    
    // Filter out empty paragraphs and normalize whitespace
    const normalizedParagraphs = paragraphs
        .filter(p => p.trim().length > 20) // Only paragraphs with meaningful content
        .map(p => p.replace(/\s+/g, ' ').trim());
    
    // For very short content, return as a single chunk
    if (normalizedParagraphs.length === 0) {
        return [content.replace(/\s+/g, ' ').trim()];
    }
    
    // Create overlapping chunks for better context retention
    const chunks = [];
    const chunkSize = 3; // Number of paragraphs per chunk
    const overlap = 1; // Number of paragraphs to overlap
    
    // If fewer paragraphs than chunk size, return as is
    if (normalizedParagraphs.length <= chunkSize) {
        return [normalizedParagraphs.join('\n\n')];
    }
    
    // Create overlapping chunks
    for (let i = 0; i < normalizedParagraphs.length - overlap; i += chunkSize - overlap) {
        const end = Math.min(i + chunkSize, normalizedParagraphs.length);
        const chunk = normalizedParagraphs.slice(i, end).join('\n\n');
        chunks.push(chunk);
        
        // Break if we've reached the end
        if (end === normalizedParagraphs.length) break;
    }
    
    return chunks;
}

// Generate embeddings using TensorFlow.js
async function generateEmbeddings(textChunks) {
    try {
        // Ensure model is loaded
        if (!isModelLoaded) {
            try {
                sentenceEncoder = await use.load();
                isModelLoaded = true;
            } catch (error) {
                console.error('Failed to load sentence encoder:', error);
                // Return empty embeddings as fallback
                return textChunks.map(() => new Array(512).fill(0));
            }
        }
        
        // Add error handling for embedding generation
        try {
            const embeddings = await sentenceEncoder.embed(textChunks);
            return await embeddings.array();
        } catch (error) {
            console.error('Error in embedding generation:', error);
            // Return empty embeddings as fallback
            return textChunks.map(() => new Array(512).fill(0));
        }
        
    } catch (error) {
        console.error('Error generating embeddings:', error);
        // Return empty embeddings as fallback
        return textChunks.map(() => new Array(512).fill(0));
    }
}

// Search knowledge base for relevant information
async function searchKnowledgeBase(query) {
    if (knowledgeBase.length === 0) return [];
    
    try {
        // Ensure model is loaded
        if (!isModelLoaded) {
            sentenceEncoder = await use.load();
            isModelLoaded = true;
        }
        
        // Generate embedding for query
        const queryEmbedding = await sentenceEncoder.embed([query]);
        const queryVector = await queryEmbedding.array();
        
        // Calculate similarity with all chunks
        const results = [];
        
        for (const doc of knowledgeBase) {
            for (let i = 0; i < doc.chunks.length; i++) {
                const chunk = doc.chunks[i];
                const similarity = cosineSimilarity(queryVector[0], chunk.embedding);
                
                if (similarity > 0.5) { // Threshold for relevance
                    results.push({
                        docId: doc.id,
                        docTitle: doc.title,
                        chunk: chunk.text,
                        similarity: similarity
                    });
                }
            }
        }
        
        // Sort by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);
        
        // Return top results
        return results.slice(0, 5);
        
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        return [];
    }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Save knowledge base to localStorage
function saveKnowledgeBase() {
    try {
        localStorage.setItem('flashgenius-kb', JSON.stringify(knowledgeBase));
        updateKnowledgeBaseDisplay();
    } catch (error) {
        console.error('Error saving knowledge base:', error);
        // Handle localStorage quota exceeded
        if (error.name === 'QuotaExceededError') {
            showModal('Storage quota exceeded. Please delete some documents from your knowledge base.');
        }
    }
}

// Load knowledge base from localStorage
function loadKnowledgeBase() {
    try {
        const savedKB = localStorage.getItem('flashgenius-kb');
        if (savedKB) {
            knowledgeBase = JSON.parse(savedKB);
            console.log('Knowledge base loaded:', knowledgeBase.length, 'documents');
            console.log('First document chunks:', knowledgeBase[0]?.chunks.length);
            updateKnowledgeBaseDisplay();
        }
    } catch (error) {
        console.error('Error loading knowledge base:', error);
    }
}

// Update knowledge base display
function updateKnowledgeBaseDisplay() {
    // Update count
    kbCount.textContent = `(${knowledgeBase.length})`;
    
    // Clear existing items
    kbDocuments.innerHTML = '';
    
    // No documents message
    if (knowledgeBase.length === 0) {
        const noDocsMessage = document.createElement('li');
        noDocsMessage.textContent = 'No documents in your knowledge base yet.';
        noDocsMessage.style.color = '#A1A1AA';
        noDocsMessage.style.padding = '1rem';
        noDocsMessage.style.fontStyle = 'italic';
        kbDocuments.appendChild(noDocsMessage);
        return;
    }
    
    // Add each document
    knowledgeBase.forEach(doc => {
        const docItem = document.createElement('li');
        docItem.className = 'kb-document-item';
        docItem.dataset.id = doc.id;
        
        const docDate = new Date(doc.date);
        const formattedDate = docDate.toLocaleDateString();
        const chunksCount = doc.chunks.length;
        
        docItem.innerHTML = `
            <div class="kb-document-info">
                <div class="kb-document-title">${doc.title}</div>
                <div class="kb-document-meta">Added: ${formattedDate} • ${chunksCount} chunks</div>
            </div>
            <div class="kb-doc-actions">
                <button class="kb-doc-btn kb-delete-btn" data-id="${doc.id}" title="Remove document">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add delete event listener
        const deleteBtn = docItem.querySelector('.kb-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteDocument(doc.id);
        });
        
        kbDocuments.appendChild(docItem);
    });
}

// Delete document from knowledge base
function deleteDocument(docId) {
    if (confirm('Are you sure you want to delete this document from your knowledge base?')) {
        // Remove from array
        knowledgeBase = knowledgeBase.filter(doc => doc.id !== docId);
        
        // Save to localStorage
        saveKnowledgeBase();
        
        // Update display
        updateKnowledgeBaseDisplay();
        
        // Show notification
        showNotification('Document deleted from knowledge base.');
    }
}

export {
    knowledgeBase,
    initKnowledgeBase,
    handleKbFileUpload,
    addToKnowledgeBase,
    deleteDocument,
    searchKnowledgeBase,
    loadKnowledgeBase
};