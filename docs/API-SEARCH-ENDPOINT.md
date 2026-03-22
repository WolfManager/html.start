# Search API Endpoint Documentation

## Overview

The `/api/search` endpoint is the core search interface for MAGNETO. It supports query parsing with search operators, intelligent query correction, and enriched result suggestions.

**Endpoint**: `GET /api/search`

**Available on**:

- Node.js: `http://localhost:3000/api/search`
- Django: `http://127.0.0.1:8000/api/search`

## Request Parameters

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `q`       | string | Yes      | The search query. Supports search operators (see below). |

## Search Operators

The following operators are supported in the query string:

| Operator     | Syntax             | Example                        | Description                          |
| ------------ | ------------------ | ------------------------------ | ------------------------------------ |
| site         | `site:domain.com`  | `python site:github.com`       | Restrict results to a specific site  |
| exclude site | `-site:domain.com` | `python -site:reddit.com`      | Exclude results from a specific site |
| filetype     | `filetype:ext`     | `python tutorial filetype:pdf` | Restrict to specific file type       |
| inurl        | `inurl:text`       | `download inurl:github`        | URL must contain text                |
| intitle      | `intitle:text`     | `intitle:documentation`        | Page title must contain text         |

## Response Structure

```json
{
  "query": "string - original query as submitted",
  "queryUsed": "string - processed query that was actually used for search",
  "appliedOperators": {
    "site": "string or null - applied site restriction",
    "excludedSite": "string or null - excluded site(s)",
    "filetype": "string or null - applied file type filter",
    "inurl": "string or null - URL requirement",
    "intitle": "string or null - title requirement",
    "cleanedQuery": "string - query with operators removed"
  },
  "queryRewrite": "string or null - if query was rewritten for better results",
  "queryCorrection": {
    "originalQuery": "string",
    "correctedQuery": "string",
    "autoApplied": "boolean - true if correction was auto-applied on zero results"
  } or null,
  "querySuggestion": {
    "originalQuery": "string",
    "suggestedQuery": "string"
  } or null,
  "suggestions": [
    "array of string - autocomplete/search suggestions, empty if results exist"
  ],
  "relatedQueries": [
    "array of string - related queries from analytics (up to 6)"
  ],
  "total": "number - total results found",
  "results": [
    {
      "title": "string",
      "summary": "string",
      "url": "string",
      "category": "string",
      "tags": ["string"],
      "rank": "number",
      "score": "number"
    }
  ],
  "servedBy": "string - 'node' or 'django' (identifies which backend served this request)"
}
```

## Response Field Details

### appliedOperators

Object containing parsed search operators extracted from the query. Useful for understanding what filters were applied.

- `site`: Single site restriction if provided (string or null)
- `excludedSite`: Excluded site(s) if provided (string or null)
- `filetype`: File type filter if provided (string or null)
- `inurl`: URL text requirement if provided (string or null)
- `intitle`: Title text requirement if provided (string or null)
- `cleanedQuery`: The query with all operators removed (string)

### queryCorrection

Returned when a spelling correction is detected and applied (only if original search returns 0 results):

- `originalQuery`: The query as submitted
- `correctedQuery`: The suggested correction
- `autoApplied`: Boolean (true if automatically applied to fetch results)

This field is `null` if no correction is needed or applicable.

### querySuggestion

Returned when the search returns sparse results (0-4 results) and a correction is suggested but not auto-applied:

- `originalQuery`: The query as submitted
- `suggestedQuery`: The suggested alternative

This field is `null` if no suggestion is relevant.

### suggestions

Array of autocomplete/search suggestions. Populated when results are empty or very sparse. Empty array when good results exist.

### relatedQueries

Array of related queries from analytics. Up to 6 results. Helps users discover related searches.

### servedBy

String identifying which backend handled the request:

- `"node"` - Node.js server
- `"django"` - Django backend

## Examples

### Simple Search

**Request**:

```
GET /api/search?q=javascript+tutorial
```

**Response**:

```json
{
  "query": "javascript tutorial",
  "queryUsed": "javascript tutorial",
  "appliedOperators": {
    "site": null,
    "excludedSite": null,
    "filetype": null,
    "inurl": null,
    "intitle": null,
    "cleanedQuery": "javascript tutorial"
  },
  "queryRewrite": null,
  "queryCorrection": null,
  "querySuggestion": null,
  "suggestions": [],
  "relatedQueries": [
    "javascript guide",
    "javascript basics",
    "learn javascript"
  ],
  "total": 42,
  "results": [
    {
      "title": "JavaScript Tutorial - Learn JS",
      "summary": "A comprehensive tutorial for learning JavaScript from basics...",
      "url": "https://example.com/js-tutorial",
      "category": "education",
      "tags": ["javascript", "programming", "tutorial"],
      "rank": 1,
      "score": 0.95
    }
  ],
  "servedBy": "django"
}
```

### Search with Site Operator

**Request**:

```
GET /api/search?q=python+site:github.com
```

**Response**:

```json
{
  "query": "python site:github.com",
  "queryUsed": "python site:github.com",
  "appliedOperators": {
    "site": "github.com",
    "excludedSite": null,
    "filetype": null,
    "inurl": null,
    "intitle": null,
    "cleanedQuery": "python"
  },
  "queryRewrite": null,
  "queryCorrection": null,
  "querySuggestion": null,
  "suggestions": [],
  "relatedQueries": ["python github", "python repositories"],
  "total": 156,
  "results": [...],
  "servedBy": "django"
}
```

### Query with Automatic Correction

**Request**:

```
GET /api/search?q=javascrpt
```

**Response** (when 0 results for "javascrpt" but results for "javascript"):

```json
{
  "query": "javascrpt",
  "queryUsed": "javascript",
  "appliedOperators": {
    "site": null,
    "excludedSite": null,
    "filetype": null,
    "inurl": null,
    "intitle": null,
    "cleanedQuery": "javascript"
  },
  "queryRewrite": null,
  "queryCorrection": {
    "originalQuery": "javascrpt",
    "correctedQuery": "javascript",
    "autoApplied": true
  },
  "querySuggestion": null,
  "suggestions": [],
  "relatedQueries": ["javascript tutorial", "javascript es6"],
  "total": 89,
  "results": [...],
  "servedBy": "django"
}
```

### Query with Suggestion (Sparse Results)

**Request**:

```
GET /api/search?q=pythn
```

**Response** (when 2 results for "pythn"):

```json
{
  "query": "pythn",
  "queryUsed": "pythn",
  "appliedOperators": {
    "site": null,
    "excludedSite": null,
    "filetype": null,
    "inurl": null,
    "intitle": null,
    "cleanedQuery": "pythn"
  },
  "queryRewrite": null,
  "queryCorrection": null,
  "querySuggestion": {
    "originalQuery": "pythn",
    "suggestedQuery": "python"
  },
  "suggestions": [],
  "relatedQueries": ["python", "python tutorial"],
  "total": 2,
  "results": [...],
  "servedBy": "django"
}
```

### Empty Results with Suggestions

**Request**:

```
GET /api/search?q=xyzabc
```

**Response** (no results, suggestions provided):

```json
{
  "query": "xyzabc",
  "queryUsed": "xyzabc",
  "appliedOperators": {
    "site": null,
    "excludedSite": null,
    "filetype": null,
    "inurl": null,
    "intitle": null,
    "cleanedQuery": "xyzabc"
  },
  "queryRewrite": null,
  "queryCorrection": null,
  "querySuggestion": null,
  "suggestions": ["xyz", "abc", "xy", "zyx"],
  "relatedQueries": ["trending searches"],
  "total": 0,
  "results": [],
  "servedBy": "django"
}
```

## HTTP Status Codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| 200  | Successful search, results returned (may be empty) |
| 400  | Missing or invalid `q` parameter                   |
| 429  | Rate limit exceeded                                |
| 500  | Server error                                       |

## Query Correction Algorithm

The search engine uses a **bounded Levenshtein distance** algorithm (edit distance ≤ 2) to suggest spelling corrections. This ensures:

- Single character typos are corrected (e.g., "javascrpt" → "javascript")
- Double character transpositions are corrected (e.g., "pythn" → "python")
- Misspellings up to 2 edits are caught

Corrections are only applied automatically when:

1. The original query returns 0 results AND
2. The corrected query returns results

Suggestions (non-auto-applied) are shown when results are sparse (0-4 results).

## Backend Compatibility

Both the Node.js and Django backends implement this API with **identical response contracts**. The `servedBy` field helps identify which backend served a particular request, useful for debugging or monitoring purposes.

## Rate Limiting

Search requests are subject to the general rate limit of the `/api/*` routes. No specific rate limiting is applied to search beyond the standard API throttling.

## Future Enhancements

- Custom ranking profiles per search type
- Advanced query syntax (boolean operators, proximity search)
- Faceted search results
- Search analytics per operator type
- A/B testing support for query rewrites
