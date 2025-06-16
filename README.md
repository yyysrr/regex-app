## Overview

This web application allows users to:
- Upload CSV/Excel files
- Describe patterns in natural language
- Use LLM to convert to regex
- Replace matched text with custom input

## Tech Stack

- **Backend**: Django + DRF
- **Frontend**: React + TailwindCSS
- **LLM**: OpenAI/GPT for regex transformation


## Setup Instructions 

### 1. Create project folder and Set up Python environment 
```bash
mkdir AI app
cd AI app
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2.Set up Django 
```bash
pip install django djangorestframework pandas openpyxl django-cors-headers
```
#### Start Django
```bash
django-admin startproject regex_app .
python manage.py startapp matcher
```
#### Register apps and middleware in regex_app/settings.py
#####
```bash
'rest_framework',
'corsheaders',
'matcher',
```
