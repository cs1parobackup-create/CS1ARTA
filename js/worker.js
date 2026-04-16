// Import the Wasm libraries via CDN (or host them locally in your repo)
importScripts('https://docs.opencv.org/4.8.0/opencv.js');
importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

// Wait for OpenCV to initialize
cv['onRuntimeInitialized'] = () => {
    postMessage({ type: 'status', message: 'OpenCV Ready' });
};

// Listen for messages from app.js
self.onmessage = async function(e) {
    if (e.data.type === 'processImage') {
        const imageData = e.data.image;
        
        // ----------------------------------------------------
        // PHASE 1: OpenCV (Image alignment & Bubble reading)
        // ----------------------------------------------------
        postMessage({ type: 'status', message: 'Aligning paper & reading bubbles...' });
        
        // Convert raw image data to an OpenCV Matrix
        let src = cv.matFromImageData(imageData);
        
        // TODO: Add edge detection, perspective transform, and bubble counting here
        
        // ----------------------------------------------------
        // PHASE 2: Tesseract (Text reading)
        // ----------------------------------------------------
        postMessage({ type: 'status', message: 'Reading handwriting...' });
        
        // TODO: Crop the text area from 'src' and pass to Tesseract
        // Example: const { data: { text } } = await Tesseract.recognize(croppedImageBuffer, 'eng');

        // Cleanup memory (Crucial in WebAssembly)
        src.delete();

        // ----------------------------------------------------
        // PHASE 3: Return Data
        // ----------------------------------------------------
        const mockResult = {
            question1: "A",
            question2: "C",
            writtenName: "John Doe"
        };

        postMessage({ type: 'result', payload: mockResult });
    }
};