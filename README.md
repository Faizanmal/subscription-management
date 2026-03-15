# Subscription Waste Manager

A comprehensive SaaS platform for managing and optimizing subscription services to reduce waste and costs.

## Overview

This application helps users track, analyze, and optimize their subscription services across multiple platforms. It provides insights into subscription usage patterns, identifies potential waste, and offers recommendations for cost savings.

## Architecture

This project consists of two main components:

- **Backend**: Django REST API with PostgreSQL database
- **Frontend**: Next.js React application

## Features

- User authentication and authorization
- Subscription tracking and management
- Analytics and reporting
- AI-powered recommendations
- Integration with popular subscription services
- Automated backup and security features
- Real-time notifications

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- PostgreSQL (for production) or SQLite (for development)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run migrations:
   ```bash
   python manage.py migrate
   ```

5. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

6. Start the development server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create `.env` files in both backend and frontend directories based on the provided `.env.example` files.

## API Documentation

Once the backend is running, visit `http://localhost:8000/api/docs/` for API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License.