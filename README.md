# Your Friends App

A mobile application built with React Native frontend and Django backend.

## Project Structure

```
your-friends/
├── back/          # Django backend API
├── front/         # React Native mobile app
└── README.md      # This file
```

## Prerequisites

- Python 3.8+ (for Django backend)
- Node.js 18+ (for React Native frontend)
- npm or yarn
- React Native development environment (Android Studio/Xcode)

## Backend Setup (Django)

1. Navigate to the backend directory:
   ```bash
   cd back
   ```

2. Create and activate virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run database migrations:
   ```bash
   python3 manage.py migrate
   ```

5. Create a superuser (optional):
   ```bash
   python3 manage.py createsuperuser
   ```

6. Start the development server:
   ```bash
   python3 manage.py runserver
   ```

The API will be available at `http://localhost:8000/api/`

## Frontend Setup (React Native)

1. Navigate to the frontend directory:
   ```bash
   cd front
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. For iOS (macOS only):
   ```bash
   cd ios && pod install && cd ..
   ```

4. Start the Metro bundler:
   ```bash
   npx react-native start
   ```

5. Run on Android:
   ```bash
   npx react-native run-android
   ```

6. Run on iOS (macOS only):
   ```bash
   npx react-native run-ios
   ```

## API Endpoints

- `GET /api/` - API root with available endpoints
- `GET /api/health/` - Health check endpoint
- `GET /admin/` - Django admin interface

## Development

### Backend
- Django project located in `back/yourfriends/`
- API app located in `back/api/`
- Add new API endpoints in `back/api/views.py` and `back/api/urls.py`

### Frontend
- Main app file: `front/App.tsx`
- API service: `front/src/services/api.js`
- Add new screens in `front/src/screens/`
- Add new components in `front/src/components/`

## Features

- Django REST API backend
- React Native mobile frontend
- CORS configured for cross-origin requests
- Basic API health check and connectivity testing
- Ready for expansion with user authentication, data models, etc.

## Next Steps

1. Define your data models in Django
2. Create API endpoints for your features
3. Build React Native screens and navigation
4. Add user authentication
5. Implement your app's core features

## Troubleshooting

### Backend Issues
- Make sure virtual environment is activated
- Check that all dependencies are installed
- Verify Django migrations are applied

### Frontend Issues
- Clear React Native cache: `npx react-native start --reset-cache`
- Reinstall node_modules: `rm -rf node_modules && npm install`
- For iOS: Clean and rebuild in Xcode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both frontend and backend
5. Submit a pull request
