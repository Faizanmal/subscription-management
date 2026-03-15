# Subscription Waste Manager - Backend

The backend API for the Subscription Waste Manager SaaS platform, built with Django REST Framework.

## Overview

This Django application provides the REST API for managing subscriptions, user authentication, analytics, and AI-powered recommendations. It handles data processing, integrations with external services, and background tasks.

## Features

- RESTful API with Django REST Framework
- User authentication and authorization
- Subscription data management
- Integration with external subscription services
- AI-powered analytics and recommendations
- Automated backup and security features
- Celery for background task processing
- PostgreSQL database support

## Getting Started

### Prerequisites

- Python 3.8+
- PostgreSQL (recommended) or SQLite (for development)

### Installation

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

4. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

5. Update the `.env` file with your configuration (database, secret keys, etc.).

6. Run database migrations:
   ```bash
   python manage.py migrate
   ```

7. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

8. Start the development server:
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000/`.

## API Documentation

- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`

## Project Structure

- `api/` - Main API app with views, models, and serializers
- `users/` - User management and authentication
- `integrations/` - External service integrations
- `services/` - Business logic and AI services
- `backups/` - Data backup functionality
- `security/` - Security-related features
- `backend/` - Django project settings and configuration

## Available Commands

- `python manage.py runserver` - Start development server
- `python manage.py migrate` - Run database migrations
- `python manage.py createsuperuser` - Create admin user
- `python manage.py collectstatic` - Collect static files
- `python manage.py test` - Run tests

## Background Tasks

This project uses Celery for background task processing. To run the Celery worker:

```bash
celery -A backend worker -l info
```

## Contributing

1. Follow Django best practices and project conventions
2. Write tests for new features
3. Ensure all tests pass before submitting PR
4. Update API documentation for new endpoints

## Related

- [Frontend](../frontend/README.md)
- [Main Project README](../README.md)