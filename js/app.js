const video = document.getElementById('cameraFeed');
const canvas = document.getElementById('snapshotCanvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('captureBtn');
const statusText = document.getElementById('statusText');

// 1. Initialize the background Web Worker
const scannerWorker = new Worker('js/worker.js');

// 2. Listen for results from the background worker
scannerWorker.onmessage = function(e) {
    if (e.data.type === 'status') {
        statusText.innerText = `Status: ${e.data.message}`;
    } else if (e.data.type === 'result') {
        statusText.innerText = "Status: Processing Complete!";
        console.log("Survey Data:", e.data.payload);
        // Here you would save e.data.payload to IndexedDB
    }
};

// 3. Start the device camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } // Forces rear camera on mobile
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing camera:", err);
        statusText.innerText = "Error: Cannot access camera.";
    }
}

// 4. Capture the frame and send it to the worker
captureBtn.addEventListener('click', () => {
    // Set canvas dimensions to match the video feed
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the current video frame onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Extract the image data (pixels)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    statusText.innerText = "Status: Analyzing image...";
    
    // Send the raw pixels to the background worker
    scannerWorker.postMessage({ 
        type: 'processImage', 
        image: imageData 
    });
});

startCamera();