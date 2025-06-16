import React, { useState } from 'react';

const API_URL = 'http://127.0.0.1:8000';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_FORMATS = ['.csv', '.xlsx', '.xls'];

// Common pattern examples for user guidance
const PATTERN_EXAMPLES = [
  { label: 'Email addresses', value: 'email addresses' },
  { label: 'Phone numbers', value: 'phone numbers' },
  { label: 'Social Security Numbers', value: 'social security numbers' },
  { label: 'Credit card numbers', value: 'credit card numbers' },
  { label: 'Dates (MM/DD/YYYY)', value: 'dates in MM/DD/YYYY format' },
  { label: 'URLs', value: 'web URLs' },
  { label: 'ZIP codes', value: 'ZIP codes' },
  { label: 'Employee IDs', value: 'employee IDs starting with EMP' }
];

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);
  const [useLLM, setUseLLM] = useState(true);
  const [patternSource, setPatternSource] = useState(null);
  const [generatedRegex, setGeneratedRegex] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle file upload and parse it via the backend
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      setError('❌ Unsupported file format.');
      setMessage('');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('❌ File too large (max 10MB).');
      setMessage('');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setMatchCount(null);
    setPatternSource(null);
    setGeneratedRegex('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_URL}/process/`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        setColumns(result.columns);
        setMessage(result.message);
        setError('');
        setMatchCount(null);
      } else {
        setError(result.error || 'Upload failed.');
        setMessage('');
      }
    } catch (err) {
      setError('Upload failed. Please check your connection.');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle pattern + replacement submission to backend
  const handlePatternApply = async () => {
    if (!pattern.trim() || !replacement.trim()) {
      setError('❌ Please enter both pattern and replacement.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setMatchCount(null);
    setPatternSource(null);
    setGeneratedRegex('');

    try {
      const res = await fetch(`${API_URL}/process/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data, 
          natural_language: pattern, 
          replacement_value: replacement,
          use_llm: useLLM
        }),
      });
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        setMatchCount(result.matches_found);
        setPatternSource(result.pattern_source);
        setGeneratedRegex(result.regex_pattern);
        setMessage(result.message || `${result.matches_found} matches replaced.`);
        setError('');
      } else {
        setError(result.error || `No matches found for "${pattern}"`);
        setMatchCount(0);
        if (result.regex_pattern) {
          setGeneratedRegex(result.regex_pattern);
          setPatternSource(result.pattern_source);
        }
      }
    } catch (err) {
      setError('Processing failed. Please check your connection.');
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset all fields to initial state
  const handleReset = () => {
    setData([]);
    setColumns([]);
    setPattern('');
    setReplacement('');
    setMessage('');
    setError('');
    setMatchCount(null);
    setPatternSource(null);
    setGeneratedRegex('');
    setShowAdvanced(false);
    
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  const handlePatternExample = (examplePattern) => {
    setPattern(examplePattern);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-blue-900 tracking-tight">
            AI-Powered Regex Pattern Replacer
          </h1>
          <p className="text-gray-600 mt-2">
            Upload a dataset and apply regex-based replacements using natural language with AI assistance
          </p>
        </header>

        {(error || message) && (
          <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
            <div
              className={`px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-all duration-300 ${
                error 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}
            >
              {error || message}
            </div>
          </div>
        )}

        <section className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
            Upload File
          </h2>
          <input
            type="file"
            onChange={handleFileUpload}
            accept={SUPPORTED_FORMATS.join(',')}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer"
          />
          <p className="text-xs text-gray-500 mt-2">
            Accepted formats: CSV, XLSX, XLS • Max size: 10MB
          </p>
        </section>

        {data.length > 0 && (
          <>
            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
                Apply Pattern
              </h2>
              
              {/* Quick examples */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-600 mb-2 block">
                  Quick Examples (click to use):
                </label>
                <div className="flex flex-wrap gap-2">
                  {PATTERN_EXAMPLES.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handlePatternExample(example.value)}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-full transition-colors border border-gray-200 hover:border-blue-300"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    Pattern Description
                  </label>
                  <input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="Describe what you want to find (e.g., 'email addresses', 'phone numbers')"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use natural language to describe the pattern
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    Replacement Value
                  </label>
                  <input
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    placeholder="What to replace matches with (e.g., '[REDACTED]', '***')"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* AI Toggle */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useLLM}
                    onChange={(e) => setUseLLM(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    🤖 Use AI to generate regex patterns
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-7">
                  {useLLM 
                    ? "AI will analyze your description and generate optimal regex patterns"
                    : "Use predefined patterns only (faster but more limited)"
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={handlePatternApply}
                  disabled={loading || !pattern.trim() || !replacement.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors font-medium"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Apply Pattern'
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors font-medium"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </button>
              </div>

              {/* Results Summary */}
              {matchCount !== null && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      {matchCount > 0 ? (
                        <p className="text-sm text-green-700 font-medium">
                          ✅ Success: {matchCount} matches found and replaced
                        </p>
                      ) : (
                        <p className="text-sm text-yellow-700 font-medium">
                          ⚠️ No matches found for the specified pattern
                        </p>
                      )}
                      
                      {patternSource && (
                        <p className="text-xs text-gray-600 mt-1">
                          Pattern generated using: <span className="font-medium capitalize">{patternSource}</span>
                          {patternSource === 'llm' && ' (AI-powered)'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Information */}
              {showAdvanced && generatedRegex && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Generated Regex Pattern:</h4>
                  <code className="text-xs bg-white p-2 rounded border font-mono text-blue-700 block overflow-x-auto">
                    {generatedRegex}
                  </code>
                  <p className="text-xs text-blue-600 mt-2">
                    This pattern was {patternSource === 'llm' ? 'generated by AI' : 'selected from predefined patterns'} 
                    based on your description.
                  </p>
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
                Data Preview
              </h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-3 text-left font-medium text-gray-700 border-b">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 border-t transition-colors">
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {row[col] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {data.length > 50 && (
                <p className="text-xs text-gray-500 mt-3 text-center bg-gray-50 py-2 rounded">
                  Showing first 50 of {data.length} rows. All data is processed, only preview is limited.
                </p>
              )}
            </section>
          </>
        )}

        {/* Help Section */}
        {data.length === 0 && (
          <section className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">How it works:</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-start space-x-3">
                <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="font-medium">Upload your data</p>
                  <p>Support for CSV, Excel files up to 10MB</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="font-medium">Describe your pattern</p>
                  <p>Use natural language like "email addresses" or "phone numbers"</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-medium">AI generates & applies</p>
                  <p>Our AI creates the perfect regex and applies replacements</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;