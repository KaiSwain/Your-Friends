from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


@api_view(['GET'])
def health_check(request):
    """
    Simple health check endpoint
    """
    return Response({
        'status': 'healthy',
        'message': 'Your Friends API is running!'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def api_root(request):
    """
    API root endpoint
    """
    return Response({
        'message': 'Welcome to Your Friends API',
        'endpoints': {
            'health': '/api/health/',
            'admin': '/admin/',
        }
    }, status=status.HTTP_200_OK)
