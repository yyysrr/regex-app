import React, { useState } from 'react';

const API_URL = 'http://127.0.0.1:8000';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_FORMATS = ['.csv', '.xlsx', '.xls'];

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);

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

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Send file to backend
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
    } catch {
      setError('Upload failed.');
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

    try {
      // Send pattern and replacement request
      const res = await fetch(`${API_URL}/process/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, natural_language: pattern, replacement_value: replacement }),
      });
      const result = await res.json();

      if (result.success) {
        setData(result.data);
        setMatchCount(result.matches_found);
        setMessage(result.message || ` ${result.matches_found} matches replaced.`);
      } else {
        setError(result.error || `No matches found for "${pattern}"`);
        setMatchCount(0);
      }
    } catch {
      setError('Processing failed. Please check your connection.');
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
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 p-6 font-sans">

      <div className="max-w-5xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-blue-900 tracking-tight">Regex Pattern Replacer</h1>
          <p className="text-gray-600 mt-2">Upload a dataset and apply regex-based replacements in natural language</p>
        </header>

        {(error || message) && (
          <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50">
            <div
              className={`px-4 py-3 rounded-md shadow-lg text-sm font-medium transition-all duration-300 ${
                error ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'
              }`}
            >
              {error || message}
            </div>
          </div>
        )}

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 1: Upload File</h2>
          <input
            type="file"
            onChange={handleFileUpload}
            accept={SUPPORTED_FORMATS.join(',')}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-2">Accepted formats: CSV, XLSX, XLS • Max size: 10MB</p>
        </section>

        {data.length > 0 && (
          <>
            <section className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 2: Apply Pattern</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Pattern</label>
                  <input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g., email, phone, date"
                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Replacement</label>
                  <input
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    placeholder="e.g., [REDACTED]"
                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePatternApply}
                  disabled={loading || !pattern.trim() || !replacement.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-5 py-2 rounded-md transition"
                >
                  {loading ? 'Applying...' : 'Apply Pattern'}
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-2 rounded-md transition"
                >
                  Reset
                </button>
              </div>

              {matchCount !== null && (
                <p className="mt-4 text-sm text-gray-600">
                  {matchCount > 0 ? (
                    <>
                      <span className="text-green-700 font-medium">✓ Matches Found:</span> {matchCount} replacements applied
                    </>
                  ) : (
                    <span className="text-yellow-700">⚠ No matches found.</span>
                  )}
                </p>
              )}
            </section>

            <section className="bg-white rounded-xl shadow p-6 overflow-auto">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Step 3: Data Preview</h2>
              <table className="min-w-full text-sm border border-gray-200">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-4 py-2 text-left font-medium border-b">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 30).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 border-t">
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2 whitespace-nowrap">
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 30 && (
                <p className="text-xs text-gray-400 mt-2">Showing first 30 of {data.length} rows.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
