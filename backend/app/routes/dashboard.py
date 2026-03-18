"""
Analytics dashboard endpoint – parses journalctl logs from the mab-backend
service and returns aggregated visitor/request statistics.

Protected by a simple API key (env var ANALYTICS_KEY).
CORS is open on this route so the standalone analytics.html can call it.
"""

import json
import os
import re
import subprocess
import urllib.request
from collections import Counter
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter()

# Regex for the structured log lines produced by middleware.py
LOG_RE = re.compile(
    r"(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+mab\s+INFO\s+"
    r"(?P<method>GET|POST|PUT|PATCH|DELETE)\s+"
    r"(?P<path>/\S*)\s*"
    r"(?P<query>\?\S+)?\s*"
    r"status=(?P<status>\d+)\s+"
    r"time=(?P<time_ms>\d+)ms\s+"
    r"ip=(?P<ip>\S+)\s+"
    r"country=(?P<country>\S*)\s+"
    r"ua=(?P<ua>.*)"
)


def _check_key(key: Optional[str]):
    expected = os.environ.get("ANALYTICS_KEY", "")
    if not expected:
        raise HTTPException(503, "ANALYTICS_KEY not configured on server")
    if key != expected:
        raise HTTPException(403, "Invalid analytics key")


def _cors_response(data: dict, request: Request) -> JSONResponse:
    """Wrap response with permissive CORS for the local HTML file."""
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        content=data,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


def _fetch_logs(since: str) -> list[dict]:
    """Run journalctl and parse structured request log lines."""
    cmd = [
        "journalctl", "--user", "-u", "mab-backend",
        "--no-pager", "--since", since,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    lines = result.stdout.splitlines()

    entries = []
    for line in lines:
        m = LOG_RE.search(line)
        if not m:
            continue
        d = m.groupdict()
        d["status"] = int(d["status"])
        d["time_ms"] = int(d["time_ms"])
        d["country"] = d["country"] or ""
        d["query"] = d["query"] or ""
        entries.append(d)
    return entries


def _classify_ua(ua: str) -> str:
    """Return a short label for the user-agent."""
    ua_lower = ua.lower()
    if "bot" in ua_lower or "spider" in ua_lower or "crawl" in ua_lower:
        return "Bot"
    if "curl" in ua_lower or "httpx" in ua_lower or "python" in ua_lower:
        return "Script"
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        return "Mobile"
    if "mozilla" in ua_lower or "chrome" in ua_lower or "safari" in ua_lower:
        return "Desktop"
    return "Other"


@router.options("/stats")
async def stats_preflight(request: Request):
    """Handle CORS preflight for the dashboard endpoint."""
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        content="",
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.get("/geoip")
async def geoip_lookup(
    request: Request,
    key: str = Query(..., description="Analytics API key"),
    ips: str = Query(..., description="Comma-separated list of IPs"),
):
    """Proxy IP geolocation via ip-api.com (HTTP, server-side only).

    GET /geoip?key=...&ips=1.2.3.4,5.6.7.8
    Returns: { "1.2.3.4": { "country": ..., "region": ..., "city": ..., "isp": ... }, ... }
    """
    _check_key(key)
    ip_list = [ip.strip() for ip in ips.split(",") if ip.strip()][:100]

    if not ip_list:
        return _cors_response({}, request)

    # ip-api.com batch: POST JSON array, returns array of results
    payload = json.dumps(
        [{"query": ip, "fields": "query,country,regionName,city,isp,status"} for ip in ip_list]
    ).encode()
    try:
        req = urllib.request.Request(
            "http://ip-api.com/batch",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return _cors_response({}, request)

    result = {}
    for entry in data:
        ip = entry.get("query", "")
        if entry.get("status") == "success":
            result[ip] = {
                "country": entry.get("country", ""),
                "region": entry.get("regionName", ""),
                "city": entry.get("city", ""),
                "isp": entry.get("isp", ""),
            }
    return _cors_response(result, request)


@router.get("/stats")
async def get_stats(
    request: Request,
    key: str = Query(..., description="Analytics API key"),
    since: str = Query("today", description="journalctl --since value, e.g. 'today', '7 days ago', '2026-03-01'"),
):
    """Return aggregated analytics from the systemd journal."""
    _check_key(key)
    entries = _fetch_logs(since)

    if not entries:
        return _cors_response({
            "total_requests": 0,
            "unique_ips": 0,
            "since": since,
            "entries_parsed": 0,
            "requests_by_hour": [],
            "top_endpoints": [],
            "top_ips": [],
            "countries": [],
            "status_codes": [],
            "avg_response_ms": 0,
            "ua_breakdown": [],
            "recent_visitors": [],
        }, request)

    # --- Aggregate ---
    ips: Counter = Counter()
    endpoints: Counter = Counter()
    countries: Counter = Counter()
    statuses: Counter = Counter()
    ua_types: Counter = Counter()
    hourly: Counter = Counter()
    ip_last_seen: dict[str, str] = {}
    ip_country: dict[str, str] = {}
    ip_ua: dict[str, str] = {}
    total_ms = 0

    for e in entries:
        ip = e["ip"]
        ips[ip] += 1
        endpoints[f"{e['method']} {e['path']}"] += 1
        if e["country"]:
            countries[e["country"]] += 1
        statuses[e["status"]] += 1
        ua_types[_classify_ua(e["ua"])] += 1
        total_ms += e["time_ms"]

        try:
            hour = e["ts"][:13]  # "2026-03-18 12"
            hourly[hour] += 1
        except Exception:
            pass

        ip_last_seen[ip] = e["ts"]
        if e["country"]:
            ip_country[ip] = e["country"]
        ip_ua[ip] = e["ua"]

    recent_visitors = sorted(ip_last_seen.items(), key=lambda x: x[1], reverse=True)

    recent_visitors_out = [
        {
            "ip": ip,
            "last_seen": ts,
            "requests": ips[ip],
            "country": ip_country.get(ip, ""),
            "ua_type": _classify_ua(ip_ua.get(ip, "")),
        }
        for ip, ts in recent_visitors[:50]
    ]

    return _cors_response({
        "total_requests": len(entries),
        "unique_ips": len(ips),
        "since": since,
        "entries_parsed": len(entries),
        "avg_response_ms": round(total_ms / len(entries), 1) if entries else 0,
        "requests_by_hour": [
            {"hour": h, "count": c}
            for h, c in sorted(hourly.items())
        ],
        "top_endpoints": [
            {"endpoint": ep, "count": c}
            for ep, c in endpoints.most_common(20)
        ],
        "top_ips": [
            {"ip": ip, "count": c, "country": ip_country.get(ip, "")}
            for ip, c in ips.most_common(20)
        ],
        "countries": [
            {"country": co, "count": c}
            for co, c in countries.most_common(20)
        ],
        "status_codes": [
            {"status": s, "count": c}
            for s, c in sorted(statuses.items())
        ],
        "ua_breakdown": [
            {"type": t, "count": c}
            for t, c in ua_types.most_common()
        ],
        "recent_visitors": recent_visitors_out,
    }, request)
