# FlashGenius – AI-Powered Flashcard Generator

FlashGenius is an AI-powered flashcard generator designed to enhance the learning experience by integrating four major AI technologies: Prompt Engineering, Retrieval-Augmented Generation (RAG), Multimodal Integration, and Synthetic Data Generation.

It generates high-quality, customized flashcards based on typed or spoken input, supports grounding in user-uploaded study materials, and offers real-world examples and variations to improve understanding — all while processing securely client-side.

---

## Features

- **Prompt Engineering**: Dynamic prompts adapt to difficulty levels for consistent flashcard quality.
- **Retrieval-Augmented Generation (RAG)**: Ground flashcards in user-uploaded documents using semantic search.
- **Multimodal Integration**: Voice input (speech-to-text) and audio playback (text-to-speech).
- **Synthetic Data Generation**: Creates alternative phrasings and real-world practical examples.
- **Privacy-First Design**: All data processing occurs locally in the browser.

---

## System Architecture

- **Frontend**: HTML, CSS, JavaScript
- **Core Logic**:
  - Flashcard Generation Engine
  - Knowledge Library Manager
  - Synthetic Data Generator
- **External APIs**:
  - OpenAI API (flashcard generation)
  - ElevenLabs API (text-to-speech)
  - Web Speech API (speech recognition)
- **Knowledge Processing**:
  - TensorFlow.js with Universal Sentence Encoder
  - Client-side document chunking, embedding, and retrieval

---

## Performance Metrics

| Feature | Performance |
|:---|:---|
| Flashcard Generation | 5–10 seconds |
| Knowledge Base Search | < 1 second |
| Speech Recognition | ~2 seconds |
| Text-to-Speech Conversion | 2–5 seconds |
| Synthetic Example Generation | 3–7 seconds |

---

## Challenges and Solutions

- **Efficient Client-side Vector Search**: Implemented TensorFlow.js with optimized document chunking.
- **Speech Recognition Compatibility**: Developed fallback mechanisms for browser differences.
- **Privacy Management**: Full client-side processing ensures no external data transfer.
- **API Error Handling**: Built robust fallback parsing and recovery strategies.
- **Context Window Limitation**: Applied smart chunking and filtering based on context relevance.

---

## Future Improvements

- Add Mermaid.js-based visualizations and concept maps.
- Implement learning analytics and spaced repetition techniques.
- Expand offline functionality (PWA support).
- Enable collaborative flashcard deck sharing.
- Add multimodal expansion for images and videos.

---

## Ethical Considerations

- **Privacy**: All user data stays local in the browser.
- **Bias Awareness**: Flashcards grounded in trusted sources with citation tracking.
- **Accessibility**: Support multiple modalities and upcoming improvements for screen readers and color contrasts.
- **Educational Responsibility**: Designed to support — not shortcut — the learning process.

---

## How to Run Locally

1. Clone or download the repository.
2. Open the project folder in **Visual Studio Code**.
3. Open `index.html`.
4. Use the **Live Preview** extension or any local server to launch the app.

---

## Project Status

- Core functionality implemented ✅
- Documentation completed ✅
- Future visual and collaborative upgrades planned 🔜

---

## Credits

- Built with OpenAI API, ElevenLabs API, Web Speech API
- Powered by TensorFlow.js and Universal Sentence Encoder

---

## License

This project is licensed under the MIT License.

---
