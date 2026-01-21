# MeowSpeechKit-A

A Node.js web application for vertical scrolling teleprompter with AI-powered text processing.

## Features

### Teleprompter Display
- Vertical scrolling display with current phrase highlighted
- Adjustable number of candidate lines (n) shown before/after current phrase
- Font size adjustment (24px - 120px)
- Speed control (0.5x - 2.0x)
- Dark mode with pure black background
- Fullscreen support
- Large timer display with countdown (10s) then count up

### Content Processing
- Import speech text and process with AI for natural segmentation
- AI models configured by administrator in JSON file
- Support for multiple AI models (GPT-4, GPT-3.5 Turbo, Claude 3)
- Streaming response with real-time progress display
- Local fallback segmentation when AI is unavailable
- SRT-like format with duration per segment

### User Management
- User registration with username/password
- Session-based authentication
- Rate limiting: 20 AI calls per user per hour
- CSV-based data storage

### Styling
- Native CSS with animations
- Beautiful, modern design
- No emojis or icons (pure text)
- Responsive layout

## Installation

```bash
npm install
```

## Usage

Start the server:
```bash
npm start
```

The application will be available at `http://localhost:10500`

## Configuration

### AI Models
Edit `config/ai-models.json` to configure AI models:
- Add API keys for your preferred AI providers
- Configure model endpoints and parameters
- Set the default model

### Data Storage
User data is stored in CSV files in the `data/` directory:
- `users.csv` - User accounts
- `rate_limits.csv` - API call tracking
- `scripts.csv` - Saved scripts

## Keyboard Shortcuts (Teleprompter Mode)
- `Space` - Pause/Resume
- `Escape` - Exit teleprompter
- `Arrow Up/Down` - Navigate between segments
- `D` - Toggle dark mode

## Tech Stack
- Node.js / Express.js
- Native CSS (no frameworks)
- Vanilla JavaScript
- CSV file-based database
- Session-based authentication