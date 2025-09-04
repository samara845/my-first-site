<?php
if (!isset($_GET['id'])) {
    die("File ID missing!");
}

$fileId = $_GET['id'];
$url = "https://drive.google.com/uc?export=download&id=" . $fileId;

// Google Drive request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
$response = curl_exec($ch);

preg_match_all('/https:\/\/[^\s"]+googlevideo\.com[^\s"]+/', $response, $matches);
curl_close($ch);

if (!empty($matches[0][0])) {
    header("Location: " . $matches[0][0]); // redirect to streamable link
} else {
    die("Stream link not found.");
}
