const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 10500;

// Constants for timing calculations
const MS_PER_WORD = 400; // Average speaking rate: 150 words/min = 400ms/word
const MIN_PHRASE_DURATION_MS = 300; // Minimum duration per phrase

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'meowspeechkit-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production', // Require HTTPS in production
        httpOnly: true, // Prevent XSS access to cookie
        sameSite: 'lax' // CSRF protection
    }
}));

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.csv');
const RATE_LIMITS_FILE = path.join(DATA_DIR, 'rate_limits.csv');
const SCRIPTS_FILE = path.join(DATA_DIR, 'scripts.csv');
const AI_CONFIG_FILE = path.join(__dirname, 'config', 'ai-models.json');

// Helper functions for CSV operations
function readCSV(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length <= 1) return [];
        
        const headers = lines[0].split(',');
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            rows.push(row);
        }
        return rows;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('Error reading CSV file:', error);
        return [];
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

function writeCSV(filePath, headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach(row => {
        const values = headers.map(h => {
            const val = row[h] || '';
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        lines.push(values.join(','));
    });
    fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

function appendCSV(filePath, headers, row) {
    const values = headers.map(h => {
        const val = row[h] || '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
    });
    fs.appendFileSync(filePath, values.join(',') + '\n');
}

// Load AI configuration
function loadAIConfig() {
    return JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf-8'));
}

// Rate limiting check
function checkRateLimit(userId) {
    const rows = readCSV(RATE_LIMITS_FILE);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCalls = rows.filter(r => 
        r.userId === userId && parseInt(r.timestamp) > oneHourAgo
    );
    return recentCalls.length < 20;
}

function recordAPICall(userId) {
    appendCSV(RATE_LIMITS_FILE, ['userId', 'timestamp'], {
        userId: userId,
        timestamp: Date.now().toString()
    });
}

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Routes

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        if (username.length < 3 || password.length < 6) {
            return res.status(400).json({ error: 'Username must be at least 3 characters and password at least 6 characters' });
        }
        
        const users = readCSV(USERS_FILE);
        const existingUser = users.find(u => u.username === username);
        
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            username: username,
            passwordHash: passwordHash,
            createdAt: new Date().toISOString()
        };
        
        appendCSV(USERS_FILE, ['id', 'username', 'passwordHash', 'createdAt'], newUser);
        
        req.session.userId = newUser.id;
        req.session.username = newUser.username;
        
        res.json({ success: true, username: newUser.username });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const users = readCSV(USERS_FILE);
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ success: true, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// Get available AI models
app.get('/api/models', requireAuth, (req, res) => {
    try {
        const config = loadAIConfig();
        const models = config.models.map(m => ({
            id: m.id,
            name: m.name
        }));
        res.json({ models, defaultModel: config.defaultModel });
    } catch (error) {
        console.error('Error loading models:', error);
        res.status(500).json({ error: 'Failed to load models' });
    }
});

// Get system prompt
app.get('/api/system-prompt', requireAuth, (req, res) => {
    try {
        const config = loadAIConfig();
        res.json({ systemPrompt: config.systemPrompt });
    } catch (error) {
        console.error('Error loading system prompt:', error);
        res.status(500).json({ error: 'Failed to load system prompt' });
    }
});

// Process text with AI (streaming)
app.post('/api/process-text', requireAuth, async (req, res) => {
    try {
        const { text, modelId, targetDuration } = req.body;
        const userId = req.session.userId;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        // Check rate limit
        if (!checkRateLimit(userId)) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded. Maximum 20 AI calls per hour.' 
            });
        }
        
        const config = loadAIConfig();
        const model = config.models.find(m => m.id === modelId) || 
                      config.models.find(m => m.id === config.defaultModel);
        
        if (!model) {
            return res.status(400).json({ error: 'Invalid model' });
        }
        
        // Record API call
        recordAPICall(userId);
        
        // Set up SSE for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        
        const durationInfo = targetDuration 
            ? `The total duration should be approximately ${targetDuration * 1000} milliseconds (${targetDuration} seconds).` 
            : '';
        
        const prompt = `Please segment the following speech text into SHORT PHRASES (2-3 words each) for a teleprompter. ${durationInfo}

Speech text:
${text}

Output the result as JSON with segments array containing text and duration (in MILLISECONDS) for each segment. Each 2-word phrase should be around 800ms, each 3-word phrase around 1200ms.`;

        // Make API request to AI model
        const requestBody = JSON.stringify({
            model: model.id,
            messages: [
                { role: 'system', content: config.systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: true,
            max_tokens: model.maxTokens
        });
        
        const url = new URL(model.apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;
        
        const apiReq = protocol.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${model.apiKey}`,
                'Content-Length': Buffer.byteLength(requestBody)
            }
        }, (apiRes) => {
            let fullContent = '';
            
            apiRes.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            // Send final content
                            res.write(`data: ${JSON.stringify({ done: true, content: fullContent })}\n\n`);
                            res.end();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                res.write(`data: ${JSON.stringify({ 
                                    content: content, 
                                    progress: true 
                                })}\n\n`);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            });
            
            apiRes.on('end', () => {
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ done: true, content: fullContent })}\n\n`);
                    res.end();
                }
            });
            
            apiRes.on('error', (error) => {
                console.error('API response error:', error);
                res.write(`data: ${JSON.stringify({ error: 'API error' })}\n\n`);
                res.end();
            });
        });
        
        apiReq.on('error', (error) => {
            console.error('API request error:', error);
            // Fallback: Generate segments locally
            const fallbackSegments = generateLocalSegments(text, targetDuration);
            res.write(`data: ${JSON.stringify({ 
                done: true, 
                content: JSON.stringify(fallbackSegments),
                fallback: true 
            })}\n\n`);
            res.end();
        });
        
        apiReq.write(requestBody);
        apiReq.end();
        
    } catch (error) {
        console.error('Process text error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process text' });
        }
    }
});

// Local fallback for text segmentation
function generateLocalSegments(text, targetDuration) {
    // Split into short phrases (2-3 words each)
    const words = text.split(/\s+/).filter(w => w.trim());
    const segments = [];
    
    const totalWords = words.length;
    const targetMs = targetDuration ? targetDuration * 1000 : null;
    
    // Calculate milliseconds per word based on speaking rate
    const msPerWord = targetMs ? (targetMs / totalWords) : MS_PER_WORD;
    
    // Group words into phrases of 2-3 words
    let currentPhrase = [];
    let phraseWordLimit = 2;
    
    for (let i = 0; i < words.length; i++) {
        currentPhrase.push(words[i]);
        
        // Check if we should end the phrase
        const shouldEnd = currentPhrase.length >= phraseWordLimit ||
                          i === words.length - 1 ||
                          words[i].match(/[.!?。！？,，;；:：]$/);
        
        if (shouldEnd && currentPhrase.length > 0) {
            const phraseText = currentPhrase.join(' ');
            const duration = Math.round(currentPhrase.length * msPerWord);
            
            segments.push({
                text: phraseText,
                duration: Math.max(MIN_PHRASE_DURATION_MS, duration)
            });
            
            currentPhrase = [];
            phraseWordLimit = phraseWordLimit === 2 ? 3 : 2;
        }
    }
    
    return { segments };
}

// Save script
app.post('/api/scripts', requireAuth, (req, res) => {
    try {
        const { id, title, content, segments } = req.body;
        const userId = req.session.userId;
        
        const scripts = readCSV(SCRIPTS_FILE);
        const existingIndex = id ? scripts.findIndex(s => s.id === id && s.userId === userId) : -1;
        
        if (existingIndex >= 0) {
            // Update existing script
            scripts[existingIndex] = {
                ...scripts[existingIndex],
                title: title || 'Untitled',
                content: content || '',
                segments: JSON.stringify(segments || [])
            };
            
            writeCSV(SCRIPTS_FILE, ['id', 'userId', 'title', 'content', 'segments', 'createdAt'], scripts);
            res.json({ success: true, id: scripts[existingIndex].id });
        } else {
            // Create new script
            const script = {
                id: uuidv4(),
                userId: userId,
                title: title || 'Untitled',
                content: content || '',
                segments: JSON.stringify(segments || []),
                createdAt: new Date().toISOString()
            };
            
            appendCSV(SCRIPTS_FILE, ['id', 'userId', 'title', 'content', 'segments', 'createdAt'], script);
            res.json({ success: true, id: script.id });
        }
    } catch (error) {
        console.error('Save script error:', error);
        res.status(500).json({ error: 'Failed to save script' });
    }
});

// Get user's scripts
app.get('/api/scripts', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const scripts = readCSV(SCRIPTS_FILE).filter(s => s.userId === userId);
        
        res.json(scripts.map(s => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt
        })));
    } catch (error) {
        console.error('Get scripts error:', error);
        res.status(500).json({ error: 'Failed to get scripts' });
    }
});

// Get specific script
app.get('/api/scripts/:id', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const scripts = readCSV(SCRIPTS_FILE);
        const script = scripts.find(s => s.id === req.params.id && s.userId === userId);
        
        if (!script) {
            return res.status(404).json({ error: 'Script not found' });
        }
        
        res.json({
            id: script.id,
            title: script.title,
            content: script.content,
            segments: JSON.parse(script.segments || '[]'),
            createdAt: script.createdAt
        });
    } catch (error) {
        console.error('Get script error:', error);
        res.status(500).json({ error: 'Failed to get script' });
    }
});

// Delete script
app.delete('/api/scripts/:id', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const scripts = readCSV(SCRIPTS_FILE);
        const filteredScripts = scripts.filter(s => !(s.id === req.params.id && s.userId === userId));
        
        if (filteredScripts.length === scripts.length) {
            return res.status(404).json({ error: 'Script not found' });
        }
        
        writeCSV(SCRIPTS_FILE, ['id', 'userId', 'title', 'content', 'segments', 'createdAt'], filteredScripts);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete script error:', error);
        res.status(500).json({ error: 'Failed to delete script' });
    }
});

// Get rate limit status
app.get('/api/rate-limit', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const rows = readCSV(RATE_LIMITS_FILE);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recentCalls = rows.filter(r => 
            r.userId === userId && parseInt(r.timestamp) > oneHourAgo
        );
        
        res.json({
            used: recentCalls.length,
            limit: 20,
            remaining: 20 - recentCalls.length
        });
    } catch (error) {
        console.error('Rate limit check error:', error);
        res.status(500).json({ error: 'Failed to check rate limit' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`MeowSpeechKit-A server running on http://localhost:${PORT}`);
});
