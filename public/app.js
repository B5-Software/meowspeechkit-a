// MeowSpeechKit-A Frontend Application

class MeowSpeechKit {
    constructor() {
        this.currentUser = null;
        this.segments = [];
        this.currentSegmentIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.timerInterval = null;
        this.playbackInterval = null;
        this.elapsedSeconds = 0;
        this.countdownSeconds = 10;
        this.playbackSpeed = 1.0;
        this.candidateLines = 2;
        this.fontSize = 48;
        this.isDarkMode = false;
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        await this.checkAuthStatus();
        await this.loadSystemPrompt();
    }
    
    bindEvents() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
        });
        
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());
        
        // Process button
        document.getElementById('process-btn').addEventListener('click', () => this.processText());
        
        // Play button
        document.getElementById('play-btn').addEventListener('click', () => this.startTeleprompter());
        
        // Teleprompter controls
        document.getElementById('font-size').addEventListener('input', (e) => this.updateFontSize(e.target.value));
        document.getElementById('speed').addEventListener('input', (e) => this.updateSpeed(e.target.value));
        document.getElementById('candidate-lines').addEventListener('input', (e) => this.updateCandidateLines(e.target.value));
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('exit-btn').addEventListener('click', () => this.exitTeleprompter());
        
        // Keyboard shortcuts for teleprompter
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    }
    
    async handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.username;
                this.showMainSection();
            } else {
                errorEl.textContent = data.error;
            }
        } catch (error) {
            errorEl.textContent = 'Login failed. Please try again.';
        }
    }
    
    async handleRegister() {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const errorEl = document.getElementById('register-error');
        
        if (password !== confirm) {
            errorEl.textContent = 'Passwords do not match.';
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.username;
                this.showMainSection();
            } else {
                errorEl.textContent = data.error;
            }
        } catch (error) {
            errorEl.textContent = 'Registration failed. Please try again.';
        }
    }
    
    async handleLogout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.showAuthSection();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentUser = data.username;
                this.showMainSection();
            } else {
                this.showAuthSection();
            }
        } catch (error) {
            this.showAuthSection();
        }
    }
    
    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
    }
    
    async showMainSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('teleprompter-section').classList.add('hidden');
        
        document.getElementById('user-info').textContent = `Welcome, ${this.currentUser}`;
        
        await this.loadModels();
        await this.updateRateLimitInfo();
    }
    
    async loadModels() {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            
            const select = document.getElementById('model-select');
            select.innerHTML = '';
            
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                if (model.id === data.defaultModel) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load models:', error);
        }
    }
    
    async loadSystemPrompt() {
        try {
            const response = await fetch('/api/system-prompt');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('system-prompt-display').textContent = data.systemPrompt;
            }
        } catch (error) {
            console.error('Failed to load system prompt:', error);
        }
    }
    
    async updateRateLimitInfo() {
        try {
            const response = await fetch('/api/rate-limit');
            const data = await response.json();
            
            document.getElementById('rate-limit-info').textContent = 
                `AI calls: ${data.used}/${data.limit} (${data.remaining} remaining)`;
        } catch (error) {
            console.error('Failed to get rate limit:', error);
        }
    }
    
    async processText() {
        const content = document.getElementById('script-content').value.trim();
        const targetDuration = document.getElementById('target-duration').value;
        const modelId = document.getElementById('model-select').value;
        
        if (!content) {
            alert('Please enter some text to process.');
            return;
        }
        
        const statusEl = document.getElementById('processing-status');
        const progressFill = statusEl.querySelector('.progress-fill');
        const processingText = document.getElementById('processing-text');
        
        statusEl.classList.remove('hidden');
        progressFill.style.width = '10%';
        processingText.textContent = 'Connecting to AI...';
        
        document.getElementById('process-btn').disabled = true;
        
        try {
            const response = await fetch('/api/process-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: content, modelId, targetDuration: parseInt(targetDuration) || null })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let progress = 10;
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.progress) {
                                fullContent += data.content;
                                progress = Math.min(progress + 2, 90);
                                progressFill.style.width = `${progress}%`;
                                processingText.textContent = 'Processing with AI...';
                            }
                            
                            if (data.done) {
                                progressFill.style.width = '100%';
                                processingText.textContent = 'Complete!';
                                
                                // Parse the content
                                const jsonContent = data.content || fullContent;
                                this.parseAndDisplaySegments(jsonContent);
                                
                                setTimeout(() => {
                                    statusEl.classList.add('hidden');
                                }, 1500);
                            }
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            if (e.message !== 'Unexpected end of JSON input') {
                                console.error('Parse error:', e);
                            }
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            processingText.textContent = `Error: ${error.message}`;
            progressFill.style.width = '0%';
            
            // Fallback: simple local segmentation
            this.localSegmentation(content, targetDuration);
            
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 3000);
        } finally {
            document.getElementById('process-btn').disabled = false;
            await this.updateRateLimitInfo();
        }
    }
    
    parseAndDisplaySegments(content) {
        try {
            // Try to extract JSON from the content
            let jsonStr = content;
            
            // Look for JSON object in the content
            const jsonMatch = content.match(/\{[\s\S]*"segments"[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            this.segments = parsed.segments || [];
            
            this.displaySegments();
        } catch (error) {
            console.error('Failed to parse segments:', error);
            // Fallback to local segmentation
            const content = document.getElementById('script-content').value.trim();
            this.localSegmentation(content);
        }
    }
    
    localSegmentation(text, targetDuration) {
        // Split by sentences
        const sentences = text.split(/(?<=[.!?。！？])\s*/).filter(s => s.trim());
        this.segments = [];
        
        const totalWords = text.split(/\s+/).length;
        const avgWordsPerSecond = targetDuration ? totalWords / targetDuration : 2.5;
        
        for (const sentence of sentences) {
            const words = sentence.trim().split(/\s+/).length;
            const duration = Math.max(1, Math.round(words / avgWordsPerSecond));
            
            if (sentence.trim()) {
                this.segments.push({
                    text: sentence.trim(),
                    duration: duration
                });
            }
        }
        
        this.displaySegments();
    }
    
    displaySegments() {
        const previewEl = document.getElementById('segments-preview');
        
        if (this.segments.length === 0) {
            previewEl.innerHTML = '<p class="placeholder-text">No segments generated</p>';
            document.getElementById('play-btn').disabled = true;
            return;
        }
        
        previewEl.innerHTML = this.segments.map((segment, index) => `
            <div class="segment-item" style="animation-delay: ${index * 0.1}s">
                <p class="segment-text">${this.escapeHtml(segment.text)}</p>
                <span class="segment-duration">${segment.duration}s</span>
            </div>
        `).join('');
        
        document.getElementById('play-btn').disabled = false;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    startTeleprompter() {
        if (this.segments.length === 0) return;
        
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('teleprompter-section').classList.remove('hidden');
        
        // Request fullscreen
        const teleprompterEl = document.getElementById('teleprompter-section');
        if (teleprompterEl.requestFullscreen) {
            teleprompterEl.requestFullscreen().catch(err => {
                console.log('Fullscreen not available:', err);
            });
        }
        
        this.currentSegmentIndex = 0;
        this.elapsedSeconds = 0;
        this.countdownSeconds = 10;
        this.isPlaying = true;
        this.isPaused = false;
        
        this.renderTeleprompterContent();
        this.startCountdown();
    }
    
    renderTeleprompterContent() {
        const contentEl = document.getElementById('teleprompter-content');
        const n = this.candidateLines;
        
        let html = '';
        
        for (let i = 0; i < this.segments.length; i++) {
            const diff = Math.abs(i - this.currentSegmentIndex);
            let className = 'teleprompter-line';
            
            if (i === this.currentSegmentIndex) {
                className += ' current';
            } else if (diff <= n) {
                className += ` adjacent-${diff}`;
            } else {
                className += ' hidden-line';
            }
            
            html += `<div class="${className}" style="font-size: ${this.fontSize}px">${this.escapeHtml(this.segments[i].text)}</div>`;
        }
        
        contentEl.innerHTML = html;
    }
    
    startCountdown() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'countdown';
        
        this.timerInterval = setInterval(() => {
            if (this.isPaused) return;
            
            if (this.countdownSeconds > 0) {
                timerEl.textContent = this.countdownSeconds;
                this.countdownSeconds--;
            } else {
                // Start actual playback
                clearInterval(this.timerInterval);
                this.startPlayback();
            }
        }, 1000 / this.playbackSpeed);
    }
    
    startPlayback() {
        const timerEl = document.getElementById('timer-value');
        timerEl.className = 'running';
        
        this.updateTimer();
        
        // Start segment timing
        this.scheduleNextSegment();
        
        // Start elapsed timer
        this.timerInterval = setInterval(() => {
            if (this.isPaused) return;
            this.elapsedSeconds++;
            this.updateTimer();
        }, 1000);
    }
    
    scheduleNextSegment() {
        if (!this.isPlaying || this.currentSegmentIndex >= this.segments.length) {
            this.finishPlayback();
            return;
        }
        
        const segment = this.segments[this.currentSegmentIndex];
        const duration = (segment.duration * 1000) / this.playbackSpeed;
        
        this.playbackInterval = setTimeout(() => {
            if (this.isPaused) {
                // Re-schedule when paused
                this.scheduleNextSegment();
                return;
            }
            
            this.currentSegmentIndex++;
            this.renderTeleprompterContent();
            this.scheduleNextSegment();
        }, duration);
    }
    
    updateTimer() {
        const timerEl = document.getElementById('timer-value');
        const minutes = Math.floor(this.elapsedSeconds / 60);
        const seconds = this.elapsedSeconds % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        pauseBtn.classList.toggle('btn-success', this.isPaused);
        pauseBtn.classList.toggle('btn-warning', !this.isPaused);
    }
    
    finishPlayback() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        const timerEl = document.getElementById('timer-value');
        timerEl.classList.add('finished');
    }
    
    exitTeleprompter() {
        clearInterval(this.timerInterval);
        clearTimeout(this.playbackInterval);
        this.isPlaying = false;
        
        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.log('Exit fullscreen error:', err);
            });
        }
        
        document.getElementById('teleprompter-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        
        // Reset controls
        document.getElementById('pause-btn').textContent = 'Pause';
        document.getElementById('pause-btn').classList.remove('btn-success');
        document.getElementById('pause-btn').classList.add('btn-warning');
    }
    
    updateFontSize(value) {
        this.fontSize = parseInt(value);
        document.getElementById('font-size-value').textContent = `${value}px`;
        
        if (this.isPlaying) {
            this.renderTeleprompterContent();
        }
    }
    
    updateSpeed(value) {
        this.playbackSpeed = parseFloat(value);
        document.getElementById('speed-value').textContent = `${value}x`;
    }
    
    updateCandidateLines(value) {
        this.candidateLines = parseInt(value);
        document.getElementById('candidate-lines-value').textContent = value;
        
        if (this.isPlaying) {
            this.renderTeleprompterContent();
        }
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        const teleprompterEl = document.getElementById('teleprompter-section');
        teleprompterEl.classList.toggle('dark-mode', this.isDarkMode);
        
        const toggleBtn = document.getElementById('dark-mode-toggle');
        toggleBtn.textContent = this.isDarkMode ? 'On' : 'Off';
        toggleBtn.classList.toggle('active', this.isDarkMode);
    }
    
    handleKeyboard(e) {
        if (!document.getElementById('teleprompter-section').classList.contains('hidden')) {
            switch (e.key) {
                case ' ':
                case 'Space':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case 'Escape':
                    this.exitTeleprompter();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (this.currentSegmentIndex > 0) {
                        this.currentSegmentIndex--;
                        this.renderTeleprompterContent();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (this.currentSegmentIndex < this.segments.length - 1) {
                        this.currentSegmentIndex++;
                        this.renderTeleprompterContent();
                    }
                    break;
                case 'd':
                case 'D':
                    this.toggleDarkMode();
                    break;
            }
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new MeowSpeechKit();
});
