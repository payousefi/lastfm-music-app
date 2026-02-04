<?php
/**
 * iTunes API Proxy
 *
 * Routes iTunes Search/Lookup API calls through this server to avoid CORS issues.
 * Apple's iTunes API has inconsistent CORS headers across their CDN nodes.
 *
 * Usage:
 *   /api/itunes-proxy.php?endpoint=search&term=artist+name&entity=musicArtist&limit=1
 *   /api/itunes-proxy.php?endpoint=lookup&id=12345&entity=album&limit=1
 */

// Suppress PHP errors/warnings from appearing in output (would break JSON)
error_reporting(0);
ini_set('display_errors', 0);

// Set CORS headers for the response
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Content-Type: application/json; charset=utf-8');

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get the endpoint type (search or lookup)
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

if (!in_array($endpoint, ['search', 'lookup'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid endpoint. Use "search" or "lookup"']);
    exit;
}

// Build the iTunes API URL
$baseUrl = 'https://itunes.apple.com/' . $endpoint;

// Forward all query parameters except 'endpoint'
$params = $_GET;
unset($params['endpoint']);

if (empty($params)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

$queryString = http_build_query($params);
$url = $baseUrl . '?' . $queryString;

// Initialize cURL
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_USERAGENT => 'MusicApp/1.0 (+https://music.payamyousefi.com)',
    CURLOPT_HTTPHEADER => [
        'Accept: application/json'
    ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

// Note: curl_close() is deprecated in PHP 8.0+ and has no effect
// The handle is automatically closed when it goes out of scope

// Handle errors
if ($error) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch from iTunes API', 'details' => $error]);
    exit;
}

// Forward the HTTP status code
http_response_code($httpCode);

// Return the response
echo $response;
