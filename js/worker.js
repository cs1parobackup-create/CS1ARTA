importScripts('https://docs.opencv.org/4.8.0/opencv.js');
importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');

let cvReady = false;

cv['onRuntimeInitialized'] = () => {
    cvReady = true;
    postMessage({ type: 'status', message: 'Engine Ready' });
};

self.onmessage = async function(e) {
    if (!cvReady) {
        postMessage({ type: 'error', message: 'OpenCV is still loading. Please wait.' });
        return;
    }

    if (e.data.type === 'processImage') {
        const imageData = e.data.image;
        let src = cv.matFromImageData(imageData);
        let dst = new cv.Mat();
        let gray = new cv.Mat();

        try {
            postMessage({ type: 'status', message: 'Applying image filters...' });

            // 1. Convert to Grayscale & Threshold to pure Black and White
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            cv.threshold(gray, dst, 150, 255, cv.THRESH_BINARY_INV);

            // ----------------------------------------------------
            // 2. OMR (Optical Mark Recognition) LOGIC
            // Define the strict coordinate zones of your printed paper here.
            // Example coordinates (X, Y, Width, Height)
            // ----------------------------------------------------
            const ZONES = {
                sex_male: { x: 200, y: 350, w: 40, h: 40 },
                sex_female: { x: 300, y: 350, w: 40, h: 40 },
                sqd1_rating5: { x: 800, y: 600, w: 40, h: 40 },
                // ... Add all your bubble coordinates here
                
                // OCR bounding box for handwriting
                service_availed_text: { x: 150, y: 450, w: 600, h: 80 }
            };

            postMessage({ type: 'status', message: 'Reading bubbles...' });

            // Helper function to count black pixels in a specific zone
            function checkBubble(mat, zone) {
                let rect = new cv.Rect(zone.x, zone.y, zone.w, zone.h);
                let roi = mat.roi(rect);
                let filledPixels = cv.countNonZero(roi);
                roi.delete();
                
                // If more than 40% of the box is black, consider it shaded
                let totalPixels = zone.w * zone.h;
                return (filledPixels / totalPixels) > 0.40; 
            }

            // Determine values based on pixel density
            let isMale = checkBubble(dst, ZONES.sex_male);
            let isFemale = checkBubble(dst, ZONES.sex_female);

            // ----------------------------------------------------
            // 3. OCR (Optical Character Recognition) LOGIC
            // ----------------------------------------------------
            postMessage({ type: 'status', message: 'Reading handwriting...' });

            // Crop the exact text box from the original colored image
            let textRect = new cv.Rect(ZONES.service_availed_text.x, ZONES.service_availed_text.y, ZONES.service_availed_text.w, ZONES.service_availed_text.h);
            let textRoi = src.roi(textRect);
            
            // Convert cropped OpenCV Mat back to ImageData for Tesseract
            let imgData = new ImageData(new Uint8ClampedArray(textRoi.data), textRoi.cols, textRoi.rows);
            
            // Create a canvas in the worker to hold the cropped image for Tesseract
            const offscreenCanvas = new OffscreenCanvas(textRoi.cols, textRoi.rows);
            const offscreenCtx = offscreenCanvas.getContext('2d');
            offscreenCtx.putImageData(imgData, 0, 0);
            const blob = await offscreenCanvas.convertToBlob();

            // Run Tesseract only on the small cropped text box
            const { data: { text } } = await Tesseract.recognize(blob, 'eng', {
                logger: m => console.log(m)
            });

            // Clean up OpenCV Memory to prevent mobile browser crashes
            src.delete(); dst.delete(); gray.delete(); textRoi.delete();

            // ----------------------------------------------------
            // 4. Construct Final Payload
            // ----------------------------------------------------
            const finalData = {
                sex: isMale ? 'Male' : (isFemale ? 'Female' : 'Unspecified'),
                service_availed: text.trim(),
                // Add the rest of your extracted fields here
            };

            postMessage({ type: 'result', payload: finalData });

        } catch (err) {
            console.error(err);
            postMessage({ type: 'error', message: 'Processing failed. Try holding the camera steadier.' });
            if (src) src.delete();
            if (dst) dst.delete();
            if (gray) gray.delete();
        }
    }
};
