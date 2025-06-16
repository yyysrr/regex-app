from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import json
import pandas as pd
import re
import openai
import os
from django.conf import settings

# Configure OpenAI
openai.api_key = os.getenv('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')


SUPPORTED_FORMATS = ['.csv', '.xlsx', '.xls']
MAX_FILE_SIZE = 10 * 1024 * 1024

# Fallback patterns for common cases
FALLBACK_PATTERNS = {
    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b',
    'name': r'\b[A-Z][a-z]+(?: [A-Z]\.)?(?: [A-Z][a-z]+)?\b',
    'id': r'\b\d+\b',
    'phone': r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
    'url': r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?',
    'date': r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b',
    'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
    'zip': r'\b\d{5}(?:-\d{4})?\b',
    'credit_card': r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
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
    
    def upload_file(self, file):
        """Handle file upload and return processed data"""
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
    
    def generate_regex_with_llm(self, natural_language_input, sample_data=None):
        """Use LLM to generate regex pattern from natural language"""
        try:
            # Prepare context with sample data if available
            context = ""
            if sample_data:
                context = f"\n\nSample data context:\n{sample_data[:200]}..."
            
            prompt = f"""
            Convert the following natural language description into a precise regex pattern.
            
            Description: "{natural_language_input}"
            {context}
            
            Requirements:
            1. Return ONLY the regex pattern
            2. Ensure the pattern is safe and won't cause catastrophic backtracking
            3. Use appropriate word boundaries and anchors
            4. Handle common variations and edge cases
            5. Make the pattern specific enough to avoid false matches
           
            Regex pattern:
            """
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a regex expert. Generate safe, efficient regex patterns from natural language descriptions. Always return only the regex pattern without any additional text or formatting."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=200,
                temperature=0.1
            )
            
            regex_pattern = response.choices[0].message.content.strip()
            
            # Clean up the response (remove any markdown formatting or extra text)
            regex_pattern = regex_pattern.replace('```', '').replace('regex', '').strip()
            if regex_pattern.startswith('r\'') and regex_pattern.endswith('\''):
                regex_pattern = regex_pattern[2:-1]
            elif regex_pattern.startswith('\'') and regex_pattern.endswith('\''):
                regex_pattern = regex_pattern[1:-1]
            
            # Validate the regex pattern
            try:
                re.compile(regex_pattern)
                return regex_pattern
            except re.error as e:
                raise Exception(f"Generated invalid regex pattern: {e}")
                
        except Exception as e:
            raise Exception(f"LLM regex generation failed: {str(e)}")
    
    def get_fallback_pattern(self, natural_language_input):
        """Get fallback pattern from predefined patterns"""
        input_lower = natural_language_input.lower().strip()
        
        for key, pattern in FALLBACK_PATTERNS.items():
            if key in input_lower or any(synonym in input_lower for synonym in self.get_synonyms(key)):
                return pattern
        return None
    
    def get_synonyms(self, pattern_type):
        """Get common synonyms for pattern types"""
        synonyms = {
            'email': ['e-mail', 'mail', 'email address'],
            'phone': ['telephone', 'mobile', 'cell', 'contact number'],
            'name': ['full name', 'person name', 'username'],
            'id': ['identifier', 'user id', 'account id'],
            'url': ['website', 'link', 'web address'],
            'date': ['timestamp', 'time', 'datetime'],
            'ssn': ['social security', 'social security number'],
            'zip': ['postal code', 'zip code'],
            'credit_card': ['card number', 'credit card number', 'payment card']
        }
        return synonyms.get(pattern_type, [])
    
    def get_sample_data(self, df, max_samples=5):
        """Extract sample data for LLM context"""
        samples = []
        for col in df.select_dtypes(include='object').columns:
            col_samples = df[col].dropna().astype(str).head(max_samples).tolist()
            if col_samples:
                samples.extend(col_samples)
        return samples[:max_samples]
    
    def process_pattern(self, body):
        """Process pattern matching with LLM integration"""
        df = pd.DataFrame(body['data'])
        natural_language_input = body.get('natural_language', '').strip()
        replacement = body.get('replacement_value', '')
        use_llm = body.get('use_llm', True)  # Allow fallback to be disabled
        
        if not natural_language_input or not replacement:
            raise Exception("Missing pattern description or replacement value.")
        
        pattern = None
        pattern_source = "fallback"
        
        # Try LLM first if enabled and API key is available
        if use_llm and openai.api_key:
            try:
                sample_data = self.get_sample_data(df)
                pattern = self.generate_regex_with_llm(natural_language_input, sample_data)
                pattern_source = "llm"
            except Exception as llm_error:
                print(f"LLM generation failed: {llm_error}")
                # Fall back to predefined patterns
                pattern = self.get_fallback_pattern(natural_language_input)
        else:
            # Use fallback patterns directly
            pattern = self.get_fallback_pattern(natural_language_input)
        
        if pattern is None:
            return JsonResponse({
                'success': False,
                'error': f"Could not generate or find a pattern for '{natural_language_input}'. Try being more specific or check your OpenAI API configuration."
            }, status=200)
        
        # Test the pattern on a small sample first
        try:
            test_matches = 0
            for col in df.select_dtypes(include='object').columns:
                col_data = df[col].astype(str).head(10)  # Test on first 10 rows
                test_matches += col_data.str.count(pattern, flags=re.IGNORECASE).sum()
                if test_matches > 0:
                    break
            
            if test_matches == 0:
                return JsonResponse({
                    'success': False,
                    'error': f"No matches found for pattern '{natural_language_input}' in the data.",
                    'regex_pattern': pattern,
                    'pattern_source': pattern_source
                }, status=200)
        
        except Exception as regex_error:
            return JsonResponse({
                'success': False,
                'error': f"Invalid regex pattern generated: {str(regex_error)}"
            }, status=400)
        
        # Count all matches
        total_matches = 0
        for col in df.select_dtypes(include='object').columns:
            col_data = df[col].astype(str)
            matches = col_data.str.count(pattern, flags=re.IGNORECASE).sum()
            total_matches += matches
        
        if total_matches == 0:
            return JsonResponse({
                'success': False,
                'error': f"No matches found for pattern '{natural_language_input}' in the data.",
                'regex_pattern': pattern,
                'pattern_source': pattern_source
            }, status=200)
        
        # Perform replacements
        for col in df.select_dtypes(include='object').columns:
            col_data = df[col].astype(str)
            df[col] = col_data.str.replace(pattern, replacement, regex=True, flags=re.IGNORECASE)
        
        return JsonResponse({
            'success': True,
            'data': json.loads(df.to_json(orient='records')),
            'regex_pattern': pattern,
            'pattern_source': pattern_source,
            'matches_found': int(total_matches),
            'message': f"{total_matches} matches replaced with '{replacement}' using {pattern_source} pattern."
        })