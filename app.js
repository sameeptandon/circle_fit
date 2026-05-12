document.addEventListener('DOMContentLoaded', () => {
    const drawingCanvas = document.getElementById('drawing-canvas');
    const overlayCanvas = document.getElementById('overlay-canvas');
    const dCtx = drawingCanvas.getContext('2d', { willReadFrequently: true });
    const oCtx = overlayCanvas.getContext('2d');
    
    const btnPen = document.getElementById('btn-pen');
    const btnEraser = document.getElementById('btn-eraser');
    const btnClear = document.getElementById('btn-clear');
    const btnShapeType = document.getElementById('btn-shape-type');
    const btnToggleShape = document.getElementById('btn-toggle-shape');
    const btnFitType = document.getElementById('btn-fit-type');
    const percentDisplay = document.getElementById('percent-display');

    const width = drawingCanvas.width;
    const height = drawingCanvas.height;

    // Fill white background initially
    dCtx.fillStyle = '#ffffff';
    dCtx.fillRect(0, 0, width, height);

    let isDrawing = false;
    let mode = 'pen'; // 'pen' or 'eraser'
    let shapeType = 'circle';
    let showShape = true;
    let fitType = 'geometric';
    const brushSize = 5;
    const eraserSize = 20;

    let clusters = [];
    let currentCluster = null;
    let lastPos = null;

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
        clusters = [];
        updateShapeFit();
    });

    btnShapeType.addEventListener('click', () => {
        if (shapeType === 'circle') {
            shapeType = 'triangle';
            btnShapeType.textContent = 'Shape: Triangle';
            btnFitType.disabled = true;
        } else if (shapeType === 'triangle') {
            shapeType = 'auto';
            btnShapeType.textContent = 'Shape: Auto';
            btnFitType.disabled = false;
        } else {
            shapeType = 'circle';
            btnShapeType.textContent = 'Shape: Circle';
            btnFitType.disabled = false;
        }
        updateShapeFit();
    });

    btnToggleShape.addEventListener('click', () => {
        showShape = !showShape;
        if (showShape) {
            btnToggleShape.textContent = 'Hide Shape';
            btnToggleShape.classList.add('active');
        } else {
            btnToggleShape.textContent = 'Show Shape';
            btnToggleShape.classList.remove('active');
        }
        updateShapeFit();
    });

    btnFitType.addEventListener('click', () => {
        if (fitType === 'algebraic') {
            fitType = 'geometric';
            btnFitType.textContent = 'Fit: Geometric';
            btnFitType.classList.add('active');
        } else {
            fitType = 'algebraic';
            btnFitType.textContent = 'Fit: Algebraic';
            btnFitType.classList.remove('active');
        }
        updateShapeFit();
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
        
        // Calculate scaling factors because CSS scales the canvas on mobile
        const scaleX = drawingCanvas.width / rect.width;
        const scaleY = drawingCanvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDrawing(e) {
        if (e.cancelable) e.preventDefault(); // prevent scrolling
        isDrawing = true;
        const pos = getMousePos(e);
        lastPos = pos;
        
        if (mode === 'pen') {
            currentCluster = {
                points: [],
                shapeType: shapeType,
                fitType: fitType
            };
            clusters.push(currentCluster);
            currentCluster.points.push(pos);
        } else if (mode === 'eraser') {
            erasePoints(pos);
        }

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
        updateShapeFit();
    }

    function draw(e) {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault(); // prevent scrolling
        const pos = getMousePos(e);
        
        if (mode === 'pen' && currentCluster) {
            addInterpolatedPoints(currentCluster, lastPos, pos);
        } else if (mode === 'eraser') {
            addInterpolatedErase(lastPos, pos);
        }
        lastPos = pos;
        
        dCtx.strokeStyle = mode === 'pen' ? '#000000' : '#ffffff';
        dCtx.lineWidth = mode === 'pen' ? brushSize : eraserSize;
        dCtx.lineTo(pos.x, pos.y);
        dCtx.stroke();
        updateShapeFit();
    }

    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            currentCluster = null;
        }
    }

    function addInterpolatedPoints(cluster, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const steps = Math.max(1, Math.ceil(dist));
        for (let i = 1; i <= steps; i++) {
            cluster.points.push({
                x: p1.x + (dx * i) / steps,
                y: p1.y + (dy * i) / steps
            });
        }
    }

    function addInterpolatedErase(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const steps = Math.max(1, Math.ceil(dist / (eraserSize / 4)));
        for (let i = 0; i <= steps; i++) {
            erasePoints({
                x: p1.x + (dx * i) / steps,
                y: p1.y + (dy * i) / steps
            });
        }
    }

    function erasePoints(pos) {
        const radiusSq = (eraserSize / 2) * (eraserSize / 2);
        for (const cluster of clusters) {
            cluster.points = cluster.points.filter(p => {
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                return (dx*dx + dy*dy) > radiusSq;
            });
        }
    }

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('touchstart', startDrawing, {passive: false});

    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('touchmove', draw, {passive: false});

    window.addEventListener('mouseup', stopDrawing);
    window.addEventListener('touchend', stopDrawing);
    window.addEventListener('touchcancel', stopDrawing);

    function distanceToSegment(p, a, b) {
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const wx = p.x - a.x;
        const wy = p.y - a.y;
        const lenSq = vx * vx + vy * vy;

        if (lenSq === 0) {
            const dx = p.x - a.x;
            const dy = p.y - a.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
        const projX = a.x + t * vx;
        const projY = a.y + t * vy;
        const dx = p.x - projX;
        const dy = p.y - projY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function samplePoints(points, maxPoints = 1200) {
        if (points.length <= maxPoints) return points;

        const step = Math.ceil(points.length / maxPoints);
        const sampled = [];
        for (let i = 0; i < points.length; i += step) {
            sampled.push(points[i]);
        }
        return sampled;
    }

    function equilateralVertices(params) {
        const [cx, cy, radius, theta] = params;
        const safeRadius = Math.max(1, radius);
        const vertices = [];

        for (let i = 0; i < 3; i++) {
            const angle = theta + i * (Math.PI * 2 / 3);
            vertices.push({
                x: cx + safeRadius * Math.cos(angle),
                y: cy + safeRadius * Math.sin(angle)
            });
        }

        return vertices;
    }

    function equilateralLoss(params, points) {
        const triangle = equilateralVertices(params);
        let total = 0;

        for (const point of points) {
            let minDistance = Infinity;
            for (let i = 0; i < 3; i++) {
                minDistance = Math.min(minDistance, distanceToSegment(point, triangle[i], triangle[(i + 1) % 3]));
            }
            total += minDistance * minDistance;
        }

        return total / points.length;
    }

    function initialEquilateralParams(points) {
        let cx = 0;
        let cy = 0;
        for (const point of points) {
            cx += point.x;
            cy += point.y;
        }
        cx /= points.length;
        cy /= points.length;

        let radius = 1;
        for (const point of points) {
            const dx = point.x - cx;
            const dy = point.y - cy;
            radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy));
        }

        let bestParams = [cx, cy, radius, 0];
        let bestLoss = Infinity;
        for (let i = 0; i < 24; i++) {
            const theta = i * Math.PI / 36;
            const candidate = [cx, cy, radius, theta];
            const loss = equilateralLoss(candidate, points);
            if (loss < bestLoss) {
                bestLoss = loss;
                bestParams = candidate;
            }
        }

        return bestParams;
    }

    function fitEquilateralTriangle(points) {
        const fitPoints = samplePoints(points);
        if (fitPoints.length < 4) return null;

        const start = initialEquilateralParams(fitPoints);
        const simplex = [
            start,
            [start[0] + 12, start[1], start[2], start[3]],
            [start[0], start[1] + 12, start[2], start[3]],
            [start[0], start[1], start[2] * 1.08 + 1, start[3]],
            [start[0], start[1], start[2], start[3] + Math.PI / 36]
        ];
        const values = simplex.map(params => equilateralLoss(params, fitPoints));

        for (let iter = 0; iter < 45; iter++) {
            const order = values.map((value, index) => ({value, index})).sort((a, b) => a.value - b.value);
            const orderedSimplex = order.map(item => simplex[item.index]);
            const orderedValues = order.map(item => values[item.index]);

            for (let i = 0; i < simplex.length; i++) {
                simplex[i] = orderedSimplex[i];
                values[i] = orderedValues[i];
            }

            const centroid = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    centroid[j] += simplex[i][j] / 4;
                }
            }

            const worst = simplex[4];
            const reflect = centroid.map((value, i) => value + (value - worst[i]));
            reflect[2] = Math.max(1, reflect[2]);
            const reflectValue = equilateralLoss(reflect, fitPoints);

            if (reflectValue < values[0]) {
                const expand = centroid.map((value, i) => value + 2 * (reflect[i] - value));
                expand[2] = Math.max(1, expand[2]);
                const expandValue = equilateralLoss(expand, fitPoints);
                simplex[4] = expandValue < reflectValue ? expand : reflect;
                values[4] = Math.min(expandValue, reflectValue);
            } else if (reflectValue < values[3]) {
                simplex[4] = reflect;
                values[4] = reflectValue;
            } else {
                const contract = centroid.map((value, i) => value + 0.5 * (worst[i] - value));
                contract[2] = Math.max(1, contract[2]);
                const contractValue = equilateralLoss(contract, fitPoints);

                if (contractValue < values[4]) {
                    simplex[4] = contract;
                    values[4] = contractValue;
                } else {
                    for (let i = 1; i < simplex.length; i++) {
                        simplex[i] = simplex[0].map((value, j) => value + 0.5 * (simplex[i][j] - value));
                        simplex[i][2] = Math.max(1, simplex[i][2]);
                        values[i] = equilateralLoss(simplex[i], fitPoints);
                    }
                }
            }
        }

        let bestIndex = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] < values[bestIndex]) bestIndex = i;
        }

        return equilateralVertices(simplex[bestIndex]);
    }

    function getTriangleFitData(cluster) {
        const points = cluster.points;
        const triangle = fitEquilateralTriangle(points);
        if (!triangle) return null;

        let intersectingCount = 0;
        for (const point of points) {
            let minDistance = Infinity;
            for (let i = 0; i < 3; i++) {
                minDistance = Math.min(minDistance, distanceToSegment(point, triangle[i], triangle[(i + 1) % 3]));
            }
            if (minDistance <= brushSize / 2.0) {
                intersectingCount++;
            }
        }
        return { shape: 'triangle', data: triangle, score: intersectingCount };
    }

    function getCircleFitData(cluster) {
        const points = cluster.points;
        let m00 = 0, m01 = 0, m02 = 0;
        let m11 = 0, m12 = 0, m22 = 0;
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

        const m10 = m01, m20 = m02, m21 = m12;
        const det = m00 * (m11 * m22 - m12 * m21) - m01 * (m10 * m22 - m12 * m20) + m02 * (m10 * m21 - m11 * m20);

        if (Math.abs(det) < 1e-10) return null;

        const inv00 =  (m11 * m22 - m12 * m21) / det;
        const inv01 = -(m01 * m22 - m02 * m21) / det;
        const inv02 =  (m01 * m12 - m02 * m11) / det;

        const inv10 = -(m10 * m22 - m12 * m20) / det;
        const inv11 =  (m00 * m22 - m02 * m20) / det;
        const inv12 = -(m00 * m12 - m02 * m10) / det;

        const inv20 =  (m10 * m21 - m11 * m20) / det;
        const inv21 = -(m00 * m21 - m01 * m20) / det;
        const inv22 =  (m00 * m11 - m01 * m10) / det;

        let xc = inv00 * v0 + inv01 * v1 + inv02 * v2;
        let yc = inv10 * v0 + inv11 * v1 + inv12 * v2;
        let w  = inv20 * v0 + inv21 * v1 + inv22 * v2;

        let rSq = w + xc * xc + yc * yc;
        if (rSq <= 0) return null;

        let r = Math.sqrt(rSq);
        
        if (cluster.fitType === 'geometric') {
            for (let iter = 0; iter < 10; iter++) {
                let j00 = 0, j01 = 0, j02 = 0;
                let j11 = 0, j12 = 0, j22 = 0;
                let f0 = 0, f1 = 0, f2 = 0;
                
                let validPoints = 0;
                for (let i = 0; i < points.length; i++) {
                    const dx = xc - points[i].x;
                    const dy = yc - points[i].y;
                    const d = Math.sqrt(dx*dx + dy*dy);
                    if (d === 0) continue;
                    
                    validPoints++;
                    const j0 = dx / d;
                    const j1 = dy / d;
                    const j2 = -1;
                    const f = d - r;
                    
                    j00 += j0 * j0; j01 += j0 * j1; j02 += j0 * j2;
                    j11 += j1 * j1; j12 += j1 * j2; j22 += j2 * j2;
                    f0 += j0 * f; f1 += j1 * f; f2 += j2 * f;
                }
                if (validPoints === 0) break;
                
                const j10 = j01, j20 = j02, j21 = j12;
                const jDet = j00 * (j11 * j22 - j12 * j21) - j01 * (j10 * j22 - j12 * j20) + j02 * (j10 * j21 - j11 * j20);
                           
                if (Math.abs(jDet) < 1e-10) break;
                
                const jInv00 =  (j11 * j22 - j12 * j21) / jDet;
                const jInv01 = -(j01 * j22 - j02 * j21) / jDet;
                const jInv02 =  (j01 * j12 - j02 * j11) / jDet;
                
                const jInv10 = -(j10 * j22 - j12 * j20) / jDet;
                const jInv11 =  (j00 * j22 - j02 * j20) / jDet;
                const jInv12 = -(j00 * j12 - j02 * j10) / jDet;
                
                const jInv20 =  (j10 * j21 - j11 * j20) / jDet;
                const jInv21 = -(j00 * j21 - j01 * j20) / jDet;
                const jInv22 =  (j00 * j11 - j01 * j10) / jDet;
                
                xc += jInv00 * (-f0) + jInv01 * (-f1) + jInv02 * (-f2);
                yc += jInv10 * (-f0) + jInv11 * (-f1) + jInv12 * (-f2);
                r  += jInv20 * (-f0) + jInv21 * (-f1) + jInv22 * (-f2);
            }
        }
        
        if (r >= 5000) return null;

        let intersectingCount = 0;
        for (let i = 0; i < points.length; i++) {
            const dx = points[i].x - xc;
            const dy = points[i].y - yc;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - r) <= brushSize / 2.0) {
                intersectingCount++;
            }
        }

        return { shape: 'circle', data: {xc, yc, r}, score: intersectingCount };
    }

    function updateShapeFit() {
        oCtx.clearRect(0, 0, width, height);
        
        let totalIntersecting = 0;
        let totalPoints = 0;

        for (const cluster of clusters) {
            const points = cluster.points;
            if (points.length <= 3) continue;
            
            totalPoints += points.length;
            
            let triResult = null;
            let circResult = null;
            
            if (cluster.shapeType === 'triangle' || cluster.shapeType === 'auto') {
                triResult = getTriangleFitData(cluster);
            }
            if (cluster.shapeType === 'circle' || cluster.shapeType === 'auto') {
                circResult = getCircleFitData(cluster);
            }
            
            let bestResult = null;
            if (cluster.shapeType === 'auto') {
                if (triResult && circResult) {
                    bestResult = triResult.score > circResult.score ? triResult : circResult;
                } else if (triResult) {
                    bestResult = triResult;
                } else if (circResult) {
                    bestResult = circResult;
                }
            } else if (cluster.shapeType === 'triangle') {
                bestResult = triResult;
            } else {
                bestResult = circResult;
            }
            
            if (bestResult) {
                totalIntersecting += bestResult.score;
                
                if (showShape) {
                    if (bestResult.shape === 'triangle') {
                        const triangle = bestResult.data;
                        oCtx.beginPath();
                        oCtx.moveTo(triangle[0].x, triangle[0].y);
                        oCtx.lineTo(triangle[1].x, triangle[1].y);
                        oCtx.lineTo(triangle[2].x, triangle[2].y);
                        oCtx.closePath();
                        oCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                        oCtx.lineWidth = brushSize;
                        oCtx.lineJoin = 'round';
                        oCtx.stroke();
                    } else if (bestResult.shape === 'circle') {
                        const {xc, yc, r} = bestResult.data;
                        oCtx.beginPath();
                        oCtx.arc(xc, yc, r, 0, Math.PI * 2);
                        oCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                        oCtx.lineWidth = Math.min(brushSize, Math.max(1, r));
                        oCtx.stroke();
                    }
                }
            }
        }
        
        if (totalPoints > 0) {
            const percent = (totalIntersecting / totalPoints) * 100;
            percentDisplay.textContent = percent.toFixed(1) + '%';
        } else {
            percentDisplay.textContent = '0.0%';
        }
    }

    // Dynamic Version Badge
    async function updateVersionBadge() {
        try {
            const response = await fetch('https://api.github.com/repos/sameeptandon/circle_fit/commits/main');
            if (response.ok) {
                const data = await response.json();
                const sha = data.sha.slice(-5);
                const date = new Date(data.commit.author.date);
                
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const yy = String(date.getFullYear()).slice(-2);
                
                let hours = date.getHours();
                const ampm = hours >= 12 ? 'pm' : 'am';
                hours = hours % 12;
                hours = hours ? hours : 12; // the hour '0' should be '12'
                const hh = String(hours).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                
                const dateStr = `${mm}/${dd}/${yy} ${hh}:${min} ${ampm}`;
                const badge = document.querySelector('.version-badge');
                if (badge) {
                    badge.textContent = `v-${sha} (${dateStr})`;
                }
            }
        } catch (e) {
            console.error('Failed to fetch commit info for version badge', e);
        }
    }
    
    // Call on load
    updateVersionBadge();
});
