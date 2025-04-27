import { flashcards, currentCardIndex, generateVariations, generateSyntheticExamples } from './main.js';

// DOM Elements
const flashcardPlaceholder = document.querySelector('.flashcard-placeholder');
const flashcard = document.querySelector('.flashcard');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const paginationText = document.getElementById('pagination-text');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const errorModal = document.getElementById('error-modal');
const errorMessage = document.getElementById('error-message');
const modalCloseBtn = document.getElementById('modal-close-btn');
const closeModalX = document.querySelector('.close-modal');
const saveNotification = document.querySelector('.save-notification');
const notificationText = document.getElementById('notification-text');


// Modal functions
function showModal(message, isError = true, showCloseButton = true) {
    errorMessage.textContent = message;
    errorModal.style.display = 'block';
    
    // Change the title based on whether it's an error or just loading
    const modalHeader = document.querySelector('.modal-header h3');
    if (modalHeader) {
        if (isError) {
            modalHeader.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
        } else {
            modalHeader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading';
        }
    }
    
    // Optionally hide close button for loading modals
    if (!showCloseButton) {
        document.querySelector('.modal-footer').style.display = 'none';
        closeModalX.style.display = 'none';
    } else {
        document.querySelector('.modal-footer').style.display = 'block';
        closeModalX.style.display = 'block';
    }
}

function closeModal() {
    errorModal.style.display = 'none';
}

// Initialize tabs
function switchTab(tabName) {
    // Update tab buttons
    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update tab contents
    tabContents.forEach(content => {
        if (content.id === tabName + '-tab') {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
}

// Show notification
function showNotification(message) {
    notificationText.textContent = message;
    saveNotification.classList.add('show');
    setTimeout(() => {
        saveNotification.classList.remove('show');
    }, 3000);
}

// Functions for synthetic data
function showVariations(card) {
    if (!card) return;
    
    // Show loading state
    showModal('Generating variations...', false);
    
    generateVariations(card)
        .then(variations => {
            closeModal();
            if (variations.length === 0) {
                showModal('Could not generate variations at this time.');
                return;
            }
            
            // Display variations
            showSyntheticDataModal('Card Variations', variations.map(v => ({
                title: v.question,
                content: v.answer
            })));
        })
        .catch(error => {
            closeModal();
            showModal('Error generating variations: ' + error.message);
        });
}

function showSyntheticExamples(concept) {
    // Get current card question if no concept is provided
    if (!concept && flashcards.length > 0 && currentCardIndex >= 0) {
        const currentCard = flashcards[currentCardIndex];
        concept = currentCard.question;
    }
    
    if (!concept) {
        showModal('No concept available to generate examples');
        return;
    }
    
    // Show loading message
    showModal('Generating examples and visualization...', false, false);
    
    // Generate examples and visualization
    generateSyntheticExamples(concept, 2)
        .then(result => {
            closeModal();
            console.log("Generated content for concept:", concept, result);
            
            // Display examples and visualization
            showSyntheticDataModal(
                `Examples: ${concept}`, 
                result.examples, 
                result.visualization
            );
        })
        .catch(error => {
            closeModal();
            console.error("Final error:", error);
            showModal('Failed to generate examples. Please try again.');
        });
}

function showSyntheticDataModal(title, items, visualization = null) {
    console.log("Showing synthetic data modal with items:", items);
    console.log("Visualization:", visualization);
  
    let modalContent = `
      <div class="modal-header">
        <h3>${title}</h3>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body synthetic-data-container">
    `;
  
    // Add visualization if provided
    if (visualization) {
      modalContent += `
        <div class="visualization-container">
          <h4>Visual Representation</h4>
          <pre class="mermaid">
  ${visualization}
          </pre>
        </div>
      `;
    }
  
    // Add examples
    items.forEach((item, index) => {
      const scenario = item.scenario || item.title || `Example ${index + 1}`;
      const explanation = item.explanation || item.content || "No content available";
      modalContent += `
        <div class="synthetic-item">
          <div class="synthetic-item-title">${index + 1}. ${scenario}</div>
          <div class="synthetic-item-content">${explanation}</div>
        </div>
      `;
    });
  
    modalContent += `
      </div>
      <div class="modal-footer">
        <button id="synthetic-close-btn" class="control-btn">Close</button>
        <button id="synthetic-save-btn" class="control-btn">Save as Flashcards</button>
      </div>
    `;
  
    const syntheticModal = document.createElement('div');
    syntheticModal.className = 'modal';
    syntheticModal.id = 'synthetic-modal';
    syntheticModal.innerHTML = `<div class="modal-content">${modalContent}</div>`;
    document.body.appendChild(syntheticModal);
    syntheticModal.style.display = 'block';
  
    // 🛠 Correct way to trigger Mermaid AFTER modal is inserted
    if (visualization) {
      setTimeout(() => {
        try {
          console.log("Attempting to render mermaid diagram");
          mermaid.contentLoaded(); // ✅ very important
        } catch (e) {
          console.error("Error rendering mermaid diagram:", e);
        }
      }, 100);  // 100ms is enough
    }
  
    // Close modal handlers
    document.querySelector('#synthetic-modal .close-modal').addEventListener('click', () => {
      document.body.removeChild(syntheticModal);
    });
    document.getElementById('synthetic-close-btn').addEventListener('click', () => {
      document.body.removeChild(syntheticModal);
    });
    document.getElementById('synthetic-save-btn').addEventListener('click', () => {
      showNotification('Synthetic items saved as flashcards!');
      document.body.removeChild(syntheticModal);
    });
}
  

function showSyntheticDataNotice() {
    const noticeHtml = `
    <div class="privacy-notice">
        <h3>About Synthetic Data Generation</h3>
        <p>FlashGenius uses AI to create additional practice materials based on your flashcards.</p>
        <p>All synthetic data is generated locally and is not stored permanently unless you choose to save it.</p>
        <p>You can disable this feature in settings at any time.</p>
        <div class="notice-controls">
            <button id="accept-synthetic" class="control-btn">Enable Feature</button>
            <button id="decline-synthetic" class="control-btn">Disable Feature</button>
        </div>
    </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `<div class="modal-content">${noticeHtml}</div>`;
    document.body.appendChild(modal);
    
    document.getElementById('accept-synthetic').addEventListener('click', () => {
        localStorage.setItem('synthetic-data-enabled', 'true');
        document.body.removeChild(modal);
    });
    
    document.getElementById('decline-synthetic').addEventListener('click', () => {
        localStorage.setItem('synthetic-data-enabled', 'false');
        document.body.removeChild(modal);
    });
}

// Update the displayed flashcard
function updateCardDisplay() {
    console.log("Updating card display with flashcards:", flashcards);
    
    if (!flashcards || flashcards.length === 0) {
        console.log("No flashcards to display");
        flashcardPlaceholder.style.display = 'flex';
        flashcard.style.display = 'none';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        paginationText.textContent = '0/0';
        return;
    }
    
    const currentCard = flashcards[currentCardIndex];
    console.log("Current card:", currentCard);
    
    if (!currentCard) {
        console.error("Current card is undefined");
        return;
    }
    
    // Update flashcard content
    const frontContent = document.querySelector('.flashcard-front .flashcard-content');
    const backContent = document.querySelector('.flashcard-back .flashcard-content');
    const sourcesContainer = document.querySelector('.flashcard-back .flashcard-sources');
    
    // Set content with fallbacks
    frontContent.textContent = currentCard.question || "Question not available";
    backContent.textContent = currentCard.answer || "Answer not available";
    
    // Clear and update sources if available
    sourcesContainer.innerHTML = '';
    if (currentCard.sources && currentCard.sources.length > 0) {
        sourcesContainer.style.display = 'block';
        
        // Add each source
        currentCard.sources.forEach(source => {
            const sourceItem = document.createElement('div');
            sourceItem.className = 'source-item';
            
            sourceItem.innerHTML = `
                <div class="source-bullet"><i class="fas fa-book"></i></div>
                <div class="source-text">From "${source.title}"</div>
            `;
            
            sourcesContainer.appendChild(sourceItem);
        });
    } else {
        sourcesContainer.style.display = 'none';
    }
    
    // Show flashcard, hide placeholder
    flashcardPlaceholder.style.display = 'none';
    flashcard.style.display = 'block';
    
    // Ensure card is showing front side
    flashcard.classList.remove('flipped');
    
    // Update pagination
    paginationText.textContent = `${currentCardIndex + 1}/${flashcards.length}`;
    
    // Update navigation buttons
    prevBtn.disabled = currentCardIndex === 0;
    nextBtn.disabled = currentCardIndex === flashcards.length - 1;
    
    // Add synthetic data buttons
    const syntheticEnabled = localStorage.getItem('synthetic-data-enabled') !== 'false';
    
    if (syntheticEnabled && flashcards.length > 0) {
        // Add variation and example buttons
        const controlsContainer = document.querySelector('.controls-left');
        
        // First check if buttons already exist
        if (!document.getElementById('variation-btn')) {
            const variationBtn = document.createElement('button');
            variationBtn.id = 'variation-btn';
            variationBtn.className = 'control-btn';
            variationBtn.innerHTML = '<i class="fas fa-random"></i> Variations';
            variationBtn.addEventListener('click', () => {
                showVariations(flashcards[currentCardIndex]);
            });
            controlsContainer.appendChild(variationBtn);
        }
        
        if (!document.getElementById('example-btn')) {
            const exampleBtn = document.createElement('button');
            exampleBtn.id = 'example-btn';
            exampleBtn.className = 'control-btn';
            exampleBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Examples';
            exampleBtn.addEventListener('click', () => {
                const concept = currentCard.question || "concept";
                showSyntheticExamples(concept);
            });
            controlsContainer.appendChild(exampleBtn);
        }
    }
}

// Wire close buttons to closeModal
modalCloseBtn.addEventListener('click', closeModal);
closeModalX.addEventListener('click', closeModal);

export {
    showModal,
    closeModal,
    showNotification,
    updateCardDisplay,
    switchTab,
    showVariations,
    showSyntheticExamples,
    showSyntheticDataNotice
};