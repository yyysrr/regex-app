from django.urls import path
from .views import RegexProcessorView

urlpatterns = [
    path('process/', RegexProcessorView.as_view()),
]
