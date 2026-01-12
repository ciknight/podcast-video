/**
 * Podcast Audio Visualizer
 * Core Logic & Visualization
 */

class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyzer = null;
        this.dataArray = null;
        this.source = null;
        this.isInitialized = false;
        this.stream = null;

        // Bands for timbre differentiation
        // Bass: 20-250Hz, Mid: 250-4000Hz, Treble: 4000-20000Hz
        this.bands = {
            bass: 0,
            mid: 0,
            treble: 0,
            average: 0
        };
    }

    async init() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 256; // High frequency resolution
            this.analyzer.smoothingTimeConstant = 0.8;

            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyzer);

            this.dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
            this.isInitialized = true;
            return true;
        } catch (err) {
            console.error('麦克风初始化失败:', err);
            return false;
        }
    }

    update() {
        if (!this.isInitialized) return;
        this.analyzer.getByteFrequencyData(this.dataArray);

        // Process bands
        const binCount = this.analyzer.frequencyBinCount;
        const bassEnd = Math.floor(binCount * 0.1);
        const midEnd = Math.floor(binCount * 0.5);

        let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;

        for (let i = 0; i < binCount; i++) {
            const value = this.dataArray[i];
            totalSum += value;
            if (i < bassEnd) bassSum += value;
            else if (i < midEnd) midSum += value;
            else trebleSum += value;
        }

        this.bands.bass = bassSum / bassEnd / 255;
        this.bands.mid = midSum / (midEnd - bassEnd) / 255;
        this.bands.treble = trebleSum / (binCount - midEnd) / 255;
        this.bands.average = totalSum / binCount / 255;
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isInitialized = false;
    }
}

class WaveVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.waves = [
            { amplitude: 50, frequency: 0.01, speed: 0.02, color: '#00f2ff', offset: 0 },
            { amplitude: 30, frequency: 0.02, speed: 0.03, color: '#7000ff', offset: 2 },
            { amplitude: 20, frequency: 0.03, speed: 0.01, color: '#ff00c8', offset: 4 }
        ];
    }

    draw(bands, sensitivity, useTrails) {
        const { width, height } = this.canvas;

        if (useTrails) {
            // Don't clear fully to create a slight motion blur effect
            this.ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
            this.ctx.fillRect(0, 0, width, height);
        } else {
            this.ctx.clearRect(0, 0, width, height);
        }

        // Draw multiple waves responding to different bands
        this.drawWave(this.waves[0], bands.bass, sensitivity, height * 0.5, 0.6);
        this.drawWave(this.waves[1], bands.mid, sensitivity, height * 0.52, 0.4);
        this.drawWave(this.waves[2], bands.treble, sensitivity, height * 0.48, 0.3);
    }

    drawWave(cfg, bandValue, sensitivity, yBase, alpha) {
        const { width } = this.canvas;
        this.ctx.beginPath();

        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, cfg.color);
        gradient.addColorStop(0.5, '#fff');
        gradient.addColorStop(1, cfg.color);

        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2 + bandValue * 10;
        this.ctx.globalAlpha = alpha + bandValue * 0.4;
        this.ctx.shadowBlur = bandValue * 20;
        this.ctx.shadowColor = cfg.color;

        // Dynamic amplitude based on audio band and sensitivity
        const amp = cfg.amplitude * bandValue * sensitivity * 3 + 10;

        for (let x = 0; x < width; x += 2) {
            const y = yBase + Math.sin(x * cfg.frequency + cfg.offset) * amp;
            if (x === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }

        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset for next draw
        cfg.offset += cfg.speed * (1 + bandValue);
    }
}

class ParticleVisualizer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.initParticles();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 1.5,
                speedY: (Math.random() - 0.5) * 1.5,
                baseAlpha: Math.random() * 0.5 + 0.2
            });
        }
    }

    draw(bands, sensitivity) {
        const { width, height } = this.canvas;
        // Particle clear is handled by main loop or wave clear

        const intensity = bands.average * sensitivity * 6;

        this.particles.forEach(p => {
            // Motion based on audio
            p.x += p.speedX * (1 + intensity);
            p.y += p.speedY * (1 + intensity);

            // Wrap around
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            // Responsive size
            const size = p.size * (1 + intensity * 0.8);

            // Color based on bands
            let hue;
            if (bands.bass > bands.mid && bands.bass > bands.treble) {
                hue = 240 + bands.bass * 40; // Blues to Purples
            } else if (bands.mid > bands.treble) {
                hue = 180 + bands.mid * 40;  // Cyans to Greens
            } else {
                hue = 320 + bands.treble * 40; // Pinks to Magentas
            }

            this.ctx.beginPath();
            this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${p.baseAlpha + bands.average})`;
            this.ctx.shadowBlur = intensity * 5;
            this.ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
            this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;
    }
}

// Main Application
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.querySelector('.status-indicator');
    const modeSelect = document.getElementById('visual-mode');
    const sensitivitySlider = document.getElementById('sensitivity');
    const trailToggle = document.getElementById('trail-toggle');
    const glassPanel = document.querySelector('.glass-panel');

    const analyzer = new AudioAnalyzer();
    const waveViz = new WaveVisualizer(canvas, ctx);
    const particleViz = new ParticleVisualizer(canvas, ctx);

    let animationId = null;
    let isUIVisible = true;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particleViz.initParticles();
    }

    window.addEventListener('resize', resize);
    resize();

    // Auto-hide UI when recording (optional feature)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'h' || e.key === 'H') {
            isUIVisible = !isUIVisible;
            document.querySelector('.controls-container').classList.toggle('hidden', !isUIVisible);
            document.querySelector('header').style.opacity = isUIVisible ? 1 : 0;
            document.querySelector('footer').style.opacity = isUIVisible ? 1 : 0;
        }
    });

    startBtn.addEventListener('click', async () => {
        const success = await analyzer.init();
        if (success) {
            statusText.innerText = '监听中';
            statusIndicator.classList.add('active');
            startBtn.disabled = true;
            stopBtn.disabled = false;
            startLoop();
        }
    });

    stopBtn.addEventListener('click', () => {
        analyzer.stop();
        cancelAnimationFrame(animationId);
        statusText.innerText = '已停止';
        statusIndicator.classList.remove('active');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    function startLoop() {
        function loop() {
            analyzer.update();
            const mode = modeSelect.value;
            const sensitivity = sensitivitySlider.value;
            const useTrails = trailToggle.checked;

            ctx.globalCompositeOperation = 'source-over';

            if (mode === 'wave') {
                waveViz.draw(analyzer.bands, sensitivity, useTrails);
            } else if (mode === 'particles') {
                if (!useTrails) ctx.clearRect(0, 0, canvas.width, canvas.height);
                else {
                    ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                particleViz.draw(analyzer.bands, sensitivity);
            } else {
                // Combined mode
                waveViz.draw(analyzer.bands, sensitivity, useTrails);
                ctx.globalCompositeOperation = 'screen';
                particleViz.draw(analyzer.bands, sensitivity);
            }

            animationId = requestAnimationFrame(loop);
        }
        loop();
    }
});
