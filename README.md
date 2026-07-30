# Candito Training Tool

A workout tracker for [Jonnie Candito's free programs](http://canditotraininghq.com/free-programs/). Enter your 1RM for bench, squat, and deadlift and the app generates your full training cycle with calculated weights and rep schemes.

Supported programs:

- **6-Week Strength Program** — the fixed six-week cycle with accessory selection
- **Linear Program** — open-ended weekly progression with Control, Power, Hypertrophy, and 3-Day variants; add weeks as you go

## Features

- Generates all programming from your 1RM inputs
- Tracks workout completion, actual reps, weight used, and perceived difficulty per set
- Shows last week's numbers while logging linear-program workouts
- Reschedulable workout dates (per-day overrides, synced across devices)
- Persists cycle data in localStorage and syncs via Firebase
- Mobile-friendly UI

## Stack

React · TypeScript · Vite · Tailwind CSS · Radix UI

## Development

```bash
npm install
npm run dev
```

## Deploying

The deploy script builds locally, pushes to `main`, then watches the GitHub Actions workflow and sends a macOS notification when it finishes.

### Prerequisites

[GitHub CLI (`gh`)](https://cli.github.com/) must be installed and authenticated:

```bash
brew install gh
gh auth login
```

### Usage

```bash
./deploy.sh
```
