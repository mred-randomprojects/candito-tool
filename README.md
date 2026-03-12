# Candito 6-Week Strength Program Tool

A workout tracker for [Jonnie Candito's 6-Week Strength Program](http://canditotraininghq.com/free-programs/). Enter your 1RM for bench, squat, and deadlift, pick your accessory exercises, and the app generates your full training cycle with calculated weights and rep schemes.

## Features

- Generates all 6 weeks of programming from your 1RM inputs
- Tracks workout completion, actual reps, weight used, and perceived difficulty per set
- Persists cycle data in localStorage
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
