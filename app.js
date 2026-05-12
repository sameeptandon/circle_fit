document.addEventListener('DOMContentLoaded', () => {
    const drawingCanvas = document.getElementById('drawing-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const dCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });
    const oCtx = overlayCanvas.getContext('2d');
    
    const btnPen = document.getElementById('btn-pen');
    const btnEraser = document.getElementById('btn-eraser');
    const btnClear = document.getElementById('btn-clear');
    const btnToggleCircle = document.getElementById('btn-toggle-circle');
    const percentDisplay = document.getElementById('percent-display');

    const width = drawingCanvas.width;
    const height = drawingCanvas.height;

    // Fill white background initially
    dCtx.fillStyle = '#ffffff';
    dCtx.fillRect(0, 0, width, height);

    let isDrawing = false;
    let mode = 'pen'; // 'pen' or 'eraser'
    let showCircle = true;
    const brushSize = 5;
    const eraserSize = 20;

    // Tool switching
    btnPen.addEventListener('click', () => {
        mode = 'pen';
        btnPen.classList.add('active');
        btnEraser.classList.remove('active');
    });

    btnEraser.addEventListener('click', () => {
        mode = 'eraser';
        btnEraser.classList.add('active');
        btnPen.classList.remove('active');
    });

    btnClear.addEventListener('click', () => {
        dCtx.fillStyle = '#ffffff';
        dCtx.fillRect(0, 0, width, height);
        updateCircleFit();
    });

    btnToggleCircle.addEventListener('click', () => {
        showCircle = !showCircle;
        if (showCircle) {
            btnToggleCircle.textContent = 'Hide Circle';
            btnToggleCircle.classList.add('active');
        } else {
            btnToggleCircle.textContent = 'Show Circle';
            btnToggleCircle.classList.remove('active');
        }
        updateCircleFit();
    });

    // Drawing Logic
    function getMousePos(e) {
        const rect = drawingCanvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        if (e.cancelable) e.preventDefault(); // prevent scrolling
        isDrawing = true;
        const pos = getMousePos(e);
        dCtx.beginPath();
        dCtx.moveTo(pos.x, pos.y);
        dCtx.lineCap = 'round';
        dCtx.lineJoin = 'round';
        
        // Draw a dot just in case user clicks without moving
        dCtx.fillStyle = mode === 'pen' ? '#000000' : '#ffffff';
        const size = mode === 'pen' ? brushSize : eraserSize;
        dCtx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
        dCtx.fill();
        
        dCtx.beginPath();
        dCtx.moveTo(pos.x, pos.y);
        updateCircleFit();
    }

    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault(); // prevent scrolling
        const pos = getMousePos(e);
        dCtx.strokeStyle = mode === 'pen' ? '#000000' : '#ffffff';
        dCtx.lineWidth = mode === 'pen' ? brushSize : eraserSize;
        dCtx.lineTo(pos.x, pos.y);
        dCtx.stroke();
        updateCircleFit();
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
        }
    }

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('touchstart', startDrawing, {passive: false});

    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('touchmove', draw, {passive: false});

    window.addEventListener('mouseup', stopDrawing);
    window.addEventListener('touchend', stopDrawing);
    window.addEventListener('touchcancel', stopDrawing);

    // Circle fitting logic
    function updateCircleFit() {
        // Clear overlay
        oCtx.clearRect(0, 0, width, height);
        
        const imgData = dCtx.getImageData(0, 0, width, height);
        const data = imgData.data;
        
        const points = [];
        
        // Find black pixels (R=0, G=0, B=0)
        // Since we anti-alias, we can just look for very dark pixels (e.g., R < 50)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (data[i] < 50 && data[i+1] < 50 && data[i+2] < 50) {
                    points.push({x, y});
                }
            }
        }

        if (points.length <= 3) {
            percentDisplay.textContent = '0.0%';
            return;
        }

        // Build 3x3 matrix M and vector V
        let m00 = 0, m01 = 0, m02 = 0;
        let m10 = 0, m11 = 0, m12 = 0;
        let m20 = 0, m21 = 0, m22 = 0;
        
        let v0 = 0, v1 = 0, v2 = 0;

        for (let i = 0; i < points.length; i++) {
            const x = points[i].x;
            const y = points[i].y;
            const x2 = x * x;
            const y2 = y * y;
            const bi = x2 + y2;

            m00 += 4 * x2;
            m01 += 4 * x * y;
            m02 += 2 * x;
            
            m11 += 4 * y2;
            m12 += 2 * y;
            
            m22 += 1;

            v0 += 2 * x * bi;
            v1 += 2 * y * bi;
            v2 += bi;
        }

        // Matrix is symmetric
        m10 = m01;
        m20 = m02;
        m21 = m12;

        // Invert 3x3 matrix using determinant and adjugate
        const det = m00 * (m11 * m22 - m12 * m21) 
                  - m01 * (m10 * m22 - m12 * m20) 
                  + m02 * (m10 * m21 - m11 * m20);

        if (Math.abs(det) < 1e-10) {
            percentDisplay.textContent = '0.0%';
            return;
        }

        const inv00 =  (m11 * m22 - m12 * m21) / det;
        const inv01 = -(m01 * m22 - m02 * m21) / det;
        const inv02 =  (m01 * m12 - m02 * m11) / det;

        const inv10 = -(m10 * m22 - m12 * m20) / det;
        const inv11 =  (m00 * m22 - m02 * m20) / det;
        const inv12 = -(m00 * m12 - m02 * m10) / det;

        const inv20 =  (m10 * m21 - m11 * m20) / det;
        const inv21 = -(m00 * m21 - m01 * m20) / det;
        const inv22 =  (m00 * m11 - m01 * m10) / det;

        // Compute c = M^-1 * V
        const xc = inv00 * v0 + inv01 * v1 + inv02 * v2;
        const yc = inv10 * v0 + inv11 * v1 + inv12 * v2;
        const w  = inv20 * v0 + inv21 * v1 + inv22 * v2;

        const rSq = w + xc * xc + yc * yc;

        if (rSq > 0) {
            const r = Math.sqrt(rSq);
            
            if (r < 5000) {
                if (showCircle) {
                    // Draw best-fit circle on overlay
                    oCtx.beginPath();
                    oCtx.arc(xc, yc, r, 0, Math.PI * 2);
                    oCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                    oCtx.lineWidth = Math.min(brushSize, Math.max(1, r));
                    oCtx.stroke();
                }

                // Calculate intersecting percentage
                let intersectingCount = 0;
                for (let i = 0; i < points.length; i++) {
                    const dx = points[i].x - xc;
                    const dy = points[i].y - yc;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (Math.abs(dist - r) <= brushSize / 2.0) {
                        intersectingCount++;
                    }
                }
                const percent = (intersectingCount / points.length) * 100;
                percentDisplay.textContent = percent.toFixed(1) + '%';
            } else {
                percentDisplay.textContent = '0.0%';
            }
        } else {
            percentDisplay.textContent = '0.0%';
        }
    }
});
