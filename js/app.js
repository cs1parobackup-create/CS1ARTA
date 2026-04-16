// Initialize Supabase (Replace with your actual Supabase URL and Anon Key)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const video = document.getElementById('cameraFeed');
const canvas = document.getElementById('snapshotCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const captureBtn = document.getElementById('captureBtn');
const statusText = document.getElementById('statusText');

// 1. Initialize the background Web Worker
const scannerWorker = new Worker('js/worker.js');

// 2. Listen for results from the background worker
scannerWorker.onmessage = async function(e) {
    if (e.data.type === 'status') {
        statusText.innerText = `Status: ${e.data.message}`;
    } else if (e.data.type === 'result') {
        statusText.innerText = "Status: Processing Complete! Saving...";
        captureBtn.disabled = false;
        captureBtn.style.opacity = "1";
        
        const surveyData = e.data.payload;
        
        // Ensure 12-hour format for the created_at timestamp
        const now = new Date();
        surveyData.created_at = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });

        await saveSurveyLocally(surveyData);
        statusText.innerText = "Status: Saved! Ready for next scan.";
    } else if (e.data.type === 'error') {
        statusText.innerText = `Error: ${e.data.message}`;
        captureBtn.disabled = false;
        captureBtn.style.opacity = "1";
    }
};

// 3. Start the device camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            statusText.innerText = "Status: Camera Ready. Align the paper.";
        };
    } catch (err) {
        statusText.innerText = "Error: Cannot access camera.";
    }
}

// 4. Capture the frame and send it to the worker
captureBtn.addEventListener('click', () => {
    captureBtn.disabled = true;
    captureBtn.style.opacity = "0.5";
    statusText.innerText = "Status: Capturing image...";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    statusText.innerText = "Status: Sending to background processor...";
    
    scannerWorker.postMessage({ type: 'processImage', image: imageData });
});

// 5. Offline-First Storage Logic
async function saveSurveyLocally(surveyData) {
    const recordId = 'survey_' + Date.now();
    const record = { id: recordId, data: surveyData, status: 'pending' };
    
    await localforage.setItem(recordId, record);
    attemptSync(); 
}

async function attemptSync() {
    if (!navigator.onLine) return; 

    const keys = await localforage.keys();
    for (let key of keys) {
        if (key.startsWith('survey_')) {
            const record = await localforage.getItem(key);
            if (record && record.status === 'pending') {
                statusText.innerText = "Status: Syncing to database...";
                
                // Push to Supabase PostgreSQL
                const { error } = await supabase.from('csm_surveys').insert([record.data]);
                
                if (!error) {
                    await localforage.removeItem(key); // Clear local after success
                } else {
                    console.error("Supabase Error:", error);
                }
            }
        }
    }
    statusText.innerText = "Status: Sync complete. Ready.";
}

// Listen for network reconnect
window.addEventListener('online', attemptSync);

startCamera();
