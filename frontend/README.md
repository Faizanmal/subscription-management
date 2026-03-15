# Subscription Waste Manager - Frontend

The frontend component of the Subscription Waste Manager SaaS platform, built with Next.js and React.

## Overview

This Next.js application provides the user interface for managing subscriptions, viewing analytics, and receiving AI-powered recommendations for optimizing subscription costs.

## Features

- Modern React-based UI with TypeScript
- Responsive design for desktop and mobile
- User authentication and dashboard
- Subscription management interface
- Analytics and reporting visualizations
- AI-powered recommendation system
- Real-time notifications

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

2. Copy the environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Update the `.env.local` file with your configuration.

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app/` - Next.js app router pages and layouts
- `src/components/` - Reusable React components
- `src/lib/` - Utility functions and configurations
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Ensure all tests pass before submitting PR
4. Update documentation as needed

## Related

- [Backend API](../backend/README.md)
- [Main Project README](../README.md)
