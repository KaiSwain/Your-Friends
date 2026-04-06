#!/bin/bash

# Your Friends App Development Script
# This script helps start both frontend and backend services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists python3; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "All prerequisites are met"
}

# Start Django backend
start_backend() {
    print_status "Starting Django backend..."
    cd back
    
    # Check if virtual environment exists in parent directory
    if [ -d "../.venv" ]; then
        source ../.venv/bin/activate
        print_success "Virtual environment activated"
    else
        print_warning "Virtual environment not found. Make sure to set it up first."
    fi
    
    # Run migrations
    python3 manage.py migrate --noinput
    
    # Start server in background
    python3 manage.py runserver &
    BACKEND_PID=$!
    
    print_success "Django backend started (PID: $BACKEND_PID)"
    cd ..
}

# Start React Native frontend
start_frontend() {
    print_status "Starting React Native frontend..."
    cd front
    
    # Start Metro bundler
    npx react-native start &
    FRONTEND_PID=$!
    
    print_success "React Native Metro bundler started (PID: $FRONTEND_PID)"
    cd ..
}

# Stop all services
cleanup() {
    print_status "Stopping services..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        print_success "Backend stopped"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        print_success "Frontend stopped"
    fi
    
    # Kill any remaining Django and Metro processes
    pkill -f "python3.*manage.py runserver" 2>/dev/null
    pkill -f "react-native start" 2>/dev/null
    
    exit 0
}

# Set up trap to handle script termination
trap cleanup EXIT INT TERM

# Main execution
case "$1" in
    "backend")
        check_prerequisites
        start_backend
        print_status "Backend is running at http://localhost:8000"
        print_status "Press Ctrl+C to stop"
        wait
        ;;
    "frontend")
        check_prerequisites
        start_frontend
        print_status "Frontend Metro bundler is running"
        print_status "Press Ctrl+C to stop"
        wait
        ;;
    "both"|"")
        check_prerequisites
        start_backend
        sleep 3
        start_frontend
        
        print_success "Both services are running!"
        print_status "Backend: http://localhost:8000"
        print_status "Frontend: Metro bundler started"
        print_status ""
        print_status "To run the mobile app:"
        print_status "  Android: npx react-native run-android"
        print_status "  iOS: npx react-native run-ios"
        print_status ""
        print_status "Press Ctrl+C to stop all services"
        
        wait
        ;;
    "help"|"-h"|"--help")
        echo "Your Friends App Development Script"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  backend    Start only the Django backend"
        echo "  frontend   Start only the React Native Metro bundler"
        echo "  both       Start both backend and frontend (default)"
        echo "  help       Show this help message"
        echo ""
        ;;
    *)
        print_error "Unknown command: $1"
        print_status "Use '$0 help' for usage information"
        exit 1
        ;;
esac