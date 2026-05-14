def classify_query(query: str) -> str:
    """
    Returns 'simple' or 'complex'.
    Simple  → routed to local Mistral (free)
    Complex → routed to Gemini (paid)
    """
    score = 0
    q = query.lower().strip()

    # ── Complexity signals (push toward Gemini) ──────────────────
    complex_keywords = [
        "analyze", "analyse", "compare", "comparison",
        "trend", "forecast", "predict", "projection",
        "why", "reason", "cause", "explain",
        "pattern", "anomaly", "anomalies",
        "risk", "across", "breakdown", "deep",
        "insight", "strategy", "recommend strategy",
        "multiple", "all departments", "year over year",
        "quarter", "monthly trend", "correlation"
    ]
    for kw in complex_keywords:
        if kw in q:
            score += 3

    if len(query) > 100:
        score += 2

    if q.count("department") > 1 or q.count("dept") > 1:
        score += 2

    if any(w in q for w in ["last month", "last quarter", "last year",
                             "this year", "ytd", "year to date"]):
        score += 2

    # ── Simplicity signals (push toward SLM) ─────────────────────
    simple_keywords = [
        "what is", "what's", "whats",
        "how much", "total", "show", "list",
        "remaining", "balance", "current",
        "how many", "count", "number of",
        "status", "budget for", "spent",
        "summary", "overview"
    ]
    for kw in simple_keywords:
        if kw in q:
            score -= 2

    if len(query) < 50:
        score -= 1

    return "complex" if score >= 4 else "simple"


def get_routing_reason(query: str) -> str:
    result = classify_query(query)
    return f"Routed to {'Gemini (complex reasoning required)' if result == 'complex' else 'SLM/Mistral (simple lookup)'}"
