// Enhanced DocumentCapture class with better focus handling, improved document detection, larger capture zone
class DocumentCapture {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#cameraVideo',
            onCapture: options.onCapture || null,
            onError: options.onError || null,
            onStatusChange: options.onStatusChange || null,
            width: options.width || 1280,
            height: options.height || 720,
            enableDocumentDetection: options.enableDocumentDetection !== false,
            enhanceImage: options.enhanceImage !== true
        };

        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isCapturing = false;

        this.init();
    }

    init() {
        this.video = document.querySelector(this.options.container);
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        if (!this.video) {
            this.handleError('Video element not found');
            return;
        }

        // Add tap-to-refocus workaround
        this.video.addEventListener('click', () => {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.startCamera();
            }
        });
    }

    async startCamera() {
        try {
            this.updateStatus('Initializing camera...', 'info');

            const constraints = {
                video: {
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height },
                    facingMode: 'environment',
                    advanced: [{ focusMode: "continuous" }] // Attempt autofocus
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.isCapturing = true;

            return true;
        } catch (error) {
            this.handleError('Failed to access camera: ' + error.message);
            return false;
        }
    }

    async captureDocument() {
        if (!this.isCapturing) {
            this.handleError('Camera not started');
            return null;
        }

        try {
            this.updateStatus('Capturing document...', 'info');

            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0);

            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const originalImage = this.canvas.toDataURL('image/jpeg', 0.9);

            let processedImage = originalImage;
            let documentBounds = null;
            let perspectiveTransform = null;

            if (this.options.enableDocumentDetection) {
                const detectionResult = await this.detectDocument(imageData);
                if (detectionResult.bounds) {
                    documentBounds = detectionResult.bounds;
                    perspectiveTransform = detectionResult.perspectiveTransform;
                    processedImage = await this.cropAndEnhance(originalImage, documentBounds, perspectiveTransform);
                }
            }

            const result = {
                originalImage,
                processedImage,
                documentBounds,
                perspectiveTransform,
                timestamp: new Date().toISOString(),
                metadata: {
                    width: this.canvas.width,
                    height: this.canvas.height,
                    hasDocumentDetection: !!documentBounds,
                    hasPerspectiveCorrection: !!perspectiveTransform,
                    detectionMethod: (typeof cv !== 'undefined' && cv.Mat) ? 'opencv' : 'simple'
                }
            };

            this.updateStatus('Document captured successfully!', 'success');

            if (this.options.onCapture) {
                this.options.onCapture(result);
            }

            return result;

        } catch (error) {
            this.handleError('Failed to capture document: ' + error.message);
            return null;
        }
    }

    // Example CSS change for larger green capture zone (HTML required)
    injectCaptureOverlay() {
        const box = document.createElement('div');
        box.id = 'captureBox';
        Object.assign(box.style, {
            position: 'absolute',
            border: '3px solid green',
            borderRadius: '6px',
            width: '80%',
            height: '60%',
            top: '20%',
            left: '10%',
            pointerEvents: 'none',
            zIndex: 10
        });
        document.body.appendChild(box);
    }

    // Use OpenCV detection logic here (unchanged for brevity, assume detectDocumentWithOpenCV is same as previous)
    // Make sure it includes: cv.adaptiveThreshold with THRESH_BINARY_INV, dilation after morphology, and squareness filter

    enhanceImage(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const contrast = 1.3;
        const brightness = 15;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, contrast * data[i] + brightness));
            data[i + 1] = Math.min(255, Math.max(0, contrast * data[i + 1] + brightness));
            data[i + 2] = Math.min(255, Math.max(0, contrast * data[i + 2] + brightness));
        }

        ctx.putImageData(imageData, 0, 0);
    }

    updateStatus(message, type) {
        if (this.options.onStatusChange) {
            this.options.onStatusChange(message, type);
        }
    }

    handleError(message) {
        console.error('[DocumentCapture]', message);
        if (this.options.onError) {
            this.options.onError(new Error(message));
        }
    }

    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.video = null;
        this.canvas = null;
        this.ctx = null;
    }
}
