# Benchmark Demo

## Micro-Project

Use a tool for putting an app under load and benchmark its performance.

## Tool

This project uses `autocannon`, a Node.js HTTP load-testing tool.

## Benchmark Target

Endpoint:

```http
GET http://localhost:3001/
```

This is the backend health endpoint in `backend/server.js`. It is the best minimal benchmark target because it is an existing working API endpoint, does not require login, does not require database seed data, and isolates baseline Express server response performance.

Expected response:

```text
Tile Pattern Generator backend is running!
```

## Repeatable Command

Start the backend:

```bash
node backend/server.js
```

Run the benchmark from the project root:

```bash
npm run benchmark
```

The command runs:

```bash
autocannon -c 25 -d 15 http://localhost:3001/
```

Configuration:

- `-c 25`: 25 concurrent connections
- `-d 15`: 15 second test duration
- URL: backend health endpoint

## Recorded Result

Date recorded: June 5, 2026

Command:

```bash
npm run benchmark
```

Result summary:

```text
Running 15s test @ http://localhost:3001/
25 connections

Latency:
2.5%: 0 ms
50%: 0 ms
97.5%: 0 ms
99%: 0 ms
Avg: 0.01 ms
Stdev: 0.05 ms
Max: 14 ms

Req/Sec:
1%: 59,359
2.5%: 59,359
50%: 63,839
97.5%: 64,447
Avg: 63,546.67
Stdev: 1,180.84
Min: 59,350

Bytes/Sec:
1%: 17.9 MB
2.5%: 17.9 MB
50%: 19.3 MB
97.5%: 19.5 MB
Avg: 19.2 MB
Stdev: 359 kB
Min: 17.9 MB

953k requests in 15.01s, 288 MB read
```

## Interpretation

The backend health endpoint handled approximately 953,000 requests over 15 seconds with 25 concurrent connections. Average throughput was 63,546.67 requests per second. Average latency was 0.01 ms, with a maximum recorded latency of 14 ms.

This benchmark measures baseline backend responsiveness for a simple existing Express endpoint. It does not measure database-heavy routes, authenticated routes, frontend rendering, file uploads, or production network performance.

## Screenshot Checklist

Capture:

1. Backend terminal showing `Server running on http://localhost:3001`.
2. Browser or terminal showing `GET http://localhost:3001/` returns the health message.
3. Terminal after running `npm run benchmark`, including the final autocannon summary.

## Short Video Script

1. Show `backend/server.js` and point out the `GET /` health endpoint.
2. Start the backend with `node backend/server.js`.
3. Open `http://localhost:3001/` and show the health response.
4. Run `npm run benchmark`.
5. Highlight the result: `953k requests in 15.01s, 288 MB read`.
6. Explain that autocannon put the existing backend endpoint under load using 25 concurrent connections for 15 seconds.

## Suggested YouTube Title

CS233 Tile Pattern Generator - Autocannon Backend Load Test Benchmark
