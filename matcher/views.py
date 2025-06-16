from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import pandas as pd
import re

SUPPORTED_FORMATS = ['.csv', '.xlsx', '.xls']
MAX_FILE_SIZE = 10 * 1024 * 1024

PATTERNS = {
    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b',
    "name" : r'\b[A-Z][a-z]+(?: [A-Z]\.)?(?: [A-Z][a-z]+)?\b',
    "id" : r'\b\d+\b',
}

@method_decorator(csrf_exempt, name='dispatch')
class RegexProcessorView(View):
    
    def post(self, request):
        try:
            if 'file' in request.FILES:
                return self.upload_file(request.FILES['file'])
            return self.process_pattern(json.loads(request.body))
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
        
    # Handel file upload
    def upload_file(self, file):
        if file.size > MAX_FILE_SIZE:
            raise Exception("File too large. Max 10MB.")
        ext = '.' + file.name.split('.')[-1].lower()
        if ext not in SUPPORTED_FORMATS:
            raise Exception("Unsupported file format.")
        
        df = pd.read_csv(file) if ext == '.csv' else pd.read_excel(file)
        if df.empty:
            raise Exception("Empty file")
        
        return JsonResponse({
            'success': True,
            'data': json.loads(df.fillna('').to_json(orient='records')),
            'columns': df.columns.tolist(),
            'message': f"{len(df)} rows loaded."
        })

    def process_pattern(self, body):
        df = pd.DataFrame(body['data'])
        pattern_key = body.get('natural_language', '').lower().strip()
        replacement = body.get('replacement_value', '')

        # Check both pattern and replacement have been provided
        if not pattern_key or not replacement:
            raise Exception("Missing pattern or replacement.")
        
        # Check if pattern exists
        pattern = None
        for key, regex in PATTERNS.items():
            if key in pattern_key or pattern_key in key:
                pattern = regex
                break
        
        # If no pattern found, return error
        if pattern is None:
            return JsonResponse({
                'success': False,
                'error': f"No matches found for '{pattern_key}'"
            }, status=200)
        
        # Count matches first
        matches = 0
        for col in df.select_dtypes(include='object').columns:
            col_data = df[col].astype(str)
            matches += col_data.str.count(pattern).sum()
        
        if matches == 0:
            return JsonResponse({
                'success': False,
                'error': f"No matches found for pattern '{pattern_key}' in the data."
            }, status=200)
        
        # Replace only if matches exist
        for col in df.select_dtypes(include='object').columns:
            col_data = df[col].astype(str)
            df[col] = col_data.str.replace(pattern, replacement, regex=True)
        
        return JsonResponse({
            'success': True,
            'data': json.loads(df.to_json(orient='records')),
            'regex_pattern': pattern,
            'matches_found': int(matches),
            'message': f"{matches} matches replaced with '{replacement}'."
        })