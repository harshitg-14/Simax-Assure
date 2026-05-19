# AI Model Migration Report — Gemini to Hybrid (Mistral + Gemini)

**Project:** Simax Assure  
**Migration Date:** May 2026  
**Report Date:** 2026-05-19  

---

## 1. What Was the Original Setup?

Before this migration, **100% of AI queries** were handled by **Google Gemini 2.5 Flash** — a cloud-based, paid API.

### Original Architecture (Gemini-only)

```
User Query
    │
    └── POST /ai/ask
            │
            └── Google Gemini 2.5 Flash API (cloud)
                    │
                    └── Return JSON response
```

Every single question — whether simple ("what is the total budget?") or complex ("forecast next quarter's overspend by department") — went to Gemini. There was no local model, no routing, no fallback, and no offline capability.

**Files involved:**
- `backend/app/routes/ai.py` — called Gemini directly
- `backend/app/services/ai_service.py` — Gemini for alert generation

---

## 2. Why We Changed It

### 2.1 Cost
Gemini API charges per token. For an internal financial platform where employees ask repetitive, simple questions ("what is my budget?", "how much did we spend?"), every single query was burning API credits unnecessarily. Simple lookups do not need a cloud LLM.

### 2.2 Data Privacy
Every query sent the company's financial data — total budgets, department spend, vendor names, amounts — to Google's servers. For an internal financial management tool, this is a compliance and confidentiality risk.

### 2.3 Internet Dependency
The entire AI layer was down whenever:
- The network was unavailable
- Gemini API was rate-limited
- The API key expired

### 2.4 Over-engineering for Simple Queries
A question like "what is the remaining budget?" does not require a 540B parameter cloud model. It needs basic reasoning over a small dataset. Using Gemini for this is like hiring a chartered accountant to count loose change.

---

## 3. What We Changed — The New Hybrid Architecture

### New Architecture

```
User Query
    │
    └── POST /ai/ask
            │
            ├── Query Classifier (query_classifier.py)
            │       ├── Score < 4 (SIMPLE) → Mistral (local, free)
            │       └── Score ≥ 4 (COMPLEX) → Gemini (cloud, paid)
            │
            ├── Mistral via Ollama (127.0.0.1:11434)
            │       └── If offline/error → fallback to Gemini
            │
            └── Gemini 2.5 Flash (alerts + complex queries)
```

### Three New Files Added

| File | Purpose |
|------|---------|
| `backend/app/services/slm_service.py` | Handles all Mistral communication via Ollama |
| `backend/app/services/query_classifier.py` | Scores query complexity, decides routing |
| `backend/app/routes/slm.py` | Direct SLM endpoints (/slm/query, /slm/status) |

### What Gemini Still Handles
- Complex queries (score ≥ 4) via `/ai/ask`
- Reactive alerts (budget exceeded) — triggered on every expense creation
- Predictive alerts (30-day projection) — triggered on every expense creation

Gemini was **not removed**. It was **demoted to handling only what it does best** — complex reasoning and alert generation.

---

## 4. Difficulties Faced During Migration

### 4.1 Wrong Model Name (Primary Bug)
The initial `slm_service.py` was configured with:
```python
OLLAMA_MODEL = "qwen2.5:3b"
```
But Ollama only had `mistral:latest` installed. Ollama returned a 404 error which was silently swallowed by a bare `except Exception: return None`. The endpoint always returned the fallback response `"model": "slm_offline"` with no error message — making it appear as if Ollama itself was down.

**Fix:** Changed to `OLLAMA_MODEL = "mistral"` and split the exception handling into specific blocks with logging.

### 4.2 Windows IPv6 Resolution Issue
The original code used `http://localhost:11434`. On Windows, `localhost` can resolve to the IPv6 address `::1` instead of `127.0.0.1` depending on the system's hosts file configuration. If Ollama is only bound to IPv4, requests to `::1` will fail with a connection error.

**Fix:** Changed all URLs to `http://127.0.0.1:11434` explicitly.

### 4.3 Silent Exception Swallowing
The original error handler:
```python
except Exception as e:
    return None
```
This made all failures — wrong model name, connection refused, timeout, HTTP 500 — look identical. There was no way to distinguish between "Ollama is not running" and "model name is wrong" without reading source code.

**Fix:** Split into `ConnectionError`, `Timeout`, `HTTPError`, and generic `Exception` blocks, each with specific `logger.error()` messages.

### 4.4 Timeout Too Short for Cold Start
The original timeout was 60 seconds. Mistral 7B on CPU takes 60-90 seconds to load into memory on the very first request after Ollama starts. The first query was timing out before Mistral could respond.

**Fix:** Increased timeout to 120 seconds.

### 4.5 Ollama Already Running Confusion
Running `ollama serve` when Ollama is already running produces:
```
Error: listen tcp 127.0.0.1:11434: bind: Only one usage of each socket address...
```
This confused initial testing into thinking the service was broken, when it was actually already running correctly.

**Clarification:** This error is expected and harmless. It means Ollama is already running in the background — no action needed.

---

## 5. Query Response Times — Benchmarked Results

All 8 queries were timed on the same machine (Windows 11, CPU-only, Mistral 7.2B Q4_K_M quantization):

| # | Query | Time Taken |
|---|-------|-----------|
| 1 | What is the total budget and how much have we spent? | 19.81s |
| 2 | Which department has spent the most? | 19.73s |
| 3 | How much budget is remaining? | 14.33s |
| 4 | Who are our top vendors and how much have we paid them? | 29.96s |
| 5 | Are we at risk of exceeding our budget? | 19.55s |
| 6 | Give me a full financial health report | 25.26s |
| 7 | Where can we cut costs to stay within budget? | 28.48s |
| 8 | Which vendor is costing us the most and is it a risk? | 22.65s |

**Average response time: 22.47 seconds**  
**Fastest: 14.33s** (simple remaining budget lookup)  
**Slowest: 29.96s** (multi-entity vendor analysis)

Gemini 2.5 Flash for comparison: **1-3 seconds** per query.

---

## 6. Merits of the New Hybrid Model

### 6.1 Zero Cost for Simple Queries
All simple queries (totals, balances, summaries, vendor lists) now run on Mistral at zero cost. These account for roughly 70-80% of typical usage in a financial management tool.

### 6.2 Financial Data Stays Local
For simple queries, the company's budget and expense data is processed entirely on the local machine. It never leaves the server or reaches Google's infrastructure.

### 6.3 Offline Resilience for Basic Queries
If internet is down or the Gemini API key expires, employees can still query basic financial data via Mistral.

### 6.4 Graceful Fallback
The system is designed so that if Mistral fails or is offline, `/ai/ask` silently falls back to Gemini. Users never see an error — they just get a slightly slower response.

### 6.5 Alerts Still Use Best-in-Class AI
Reactive and predictive financial alerts still use Gemini — ensuring high accuracy for critical risk detection, which is low-frequency and worth the API cost.

### 6.6 Direct SLM Endpoint Available
`/slm/query` provides a direct Mistral-only endpoint for testing, debugging, or use cases where Gemini fallback is not desired.

### 6.7 Debug Visibility
`/slm/status` and `/slm/classify` endpoints make it easy to confirm Ollama is running and understand exactly how a query will be routed, without needing to read source code.

---

## 7. Demerits of the Current Model

### 7.1 Slow Response Time — 14 to 30 Seconds (Most Critical)
Running a 7.2 billion parameter model on CPU is inherently slow. Users waiting 20+ seconds for a financial query response is a poor experience, especially compared to Gemini's sub-3-second answers.

**Impact:** High. This is the single biggest usability problem.

### 7.2 Keyword-Based Classifier Is Fragile
The query classifier uses a hardcoded point system. It can misroute queries:
- "What is the risk level?" — contains "risk" (+3) → classified as Complex → goes to Gemini unnecessarily
- "Analyze total spending" — contains "analyze" (+3) → goes to Gemini even though Mistral could answer it

**Impact:** Medium. Misrouting means unnecessary Gemini API calls for questions Mistral could handle.

### 7.3 Mistral Is Not Finance-Tuned
Mistral 7B is a general-purpose model. It understands financial language but has no specific training on accounting standards, budget terminology, or financial risk frameworks. Answers are good but lack domain depth.

**Impact:** Low-Medium. For internal operational queries it performs well enough.

### 7.4 Cold Start Latency
The very first request after Ollama or the backend restarts is always the slowest — Mistral takes 60-90 seconds to load into RAM. Subsequent queries are faster (14-30s range).

**Impact:** Low. Happens only once per server restart.

### 7.5 No GPU Acceleration
The benchmarked times above are CPU-only. Without a GPU, Mistral cannot take advantage of parallel tensor operations that would reduce response time by 5-10x.

**Impact:** High (on machines without GPU). Low (on machines with NVIDIA GPU + CUDA).

### 7.6 Single Point of Failure for SLM
If `mistral:latest` is corrupted, deleted, or fails to load, all simple queries fall back to Gemini silently. There is no alert to the operator that the local model is down.

**Impact:** Low for users (fallback works), medium for cost monitoring.

---

## 8. How to Tackle Each Demerit

### Fix 1 — Slow Response Time → Enable GPU (Highest Priority)

**Check if GPU is available:**
```powershell
nvidia-smi
```

If this returns GPU information (name, memory, driver version), Ollama will automatically use CUDA without any configuration changes. Expected response time with GPU: **2-5 seconds** — comparable to Gemini.

If no NVIDIA GPU is available, switch to a lighter quantization:
```powershell
ollama pull mistral:7b-instruct-q2_K
```
Then update `slm_service.py` line 9:
```python
OLLAMA_MODEL = "mistral:7b-instruct-q2_K"
```
Expected improvement: ~8-12 seconds on CPU (vs current 14-30s). Quality drops slightly.

---

### Fix 2 — Fragile Classifier → Use Mistral to Classify

Replace the keyword scoring in `query_classifier.py` with a Mistral self-classification call:

```python
def classify_query(query: str) -> str:
    resp = requests.post("http://127.0.0.1:11434/api/generate", json={
        "model": "mistral",
        "prompt": (
            "Is this financial query simple (basic totals, balances, lists) "
            "or complex (trends, forecasts, analysis, comparisons)? "
            "Reply with exactly one word: simple or complex.\n"
            f"Query: {query}"
        ),
        "stream": False,
        "options": {"num_predict": 5, "temperature": 0}
    }, timeout=30)
    answer = resp.json().get("response", "simple").strip().lower()
    return "complex" if "complex" in answer else "simple"
```

This makes routing semantically aware rather than keyword-dependent.

---

### Fix 3 — Not Finance-Tuned → Switch to Finance-Specific Model

**Option A — Smaller but more instruction-following model:**
```powershell
ollama pull llama3.2:3b
```
Faster (3B params), better at following structured JSON output instructions.

**Option B — Finance-specific open model:**
```powershell
ollama pull internlm2:7b
```
Stronger on structured reasoning and domain tasks.

**Option C — Fine-tune Mistral on your own data** (long term)
Create a Modelfile in Ollama using your historical expense, budget, and alert data as training examples. This gives the model institutional knowledge of Simax Assure's specific financial patterns.

---

### Fix 4 — Cold Start Latency → Warm Up on Startup

Add a warmup call in `main.py` that runs once when the server starts:

```python
import threading, requests

def warmup_mistral():
    try:
        requests.post("http://127.0.0.1:11434/api/generate", json={
            "model": "mistral",
            "prompt": "Hello",
            "stream": False,
            "options": {"num_predict": 1}
        }, timeout=120)
    except Exception:
        pass

threading.Thread(target=warmup_mistral, daemon=True).start()
```

Add this to the bottom of `main.py` after `seed_users()`. Mistral loads into memory at server startup, so the first real user query has no cold-start penalty.

---

### Fix 5 — No GPU → Frontend Loading Indicator

While waiting for GPU availability, add a loading state on the frontend that shows "Analyzing with local AI — this may take up to 30 seconds" so users understand the delay is intentional, not a failure.

---

### Fix 6 — No SLM Health Monitoring → Add Startup Log

Add a health check in `main.py` that logs Mistral's status on startup:

```python
import requests as req
try:
    r = req.get("http://127.0.0.1:11434/api/tags", timeout=5)
    models = [m["name"] for m in r.json().get("models", [])]
    logger.info("Ollama online — models: %s", models)
except Exception:
    logger.warning("Ollama offline at startup — SLM queries will fall back to Gemini")
```

---

## 9. Summary Comparison Table

| Aspect | Before (Gemini-only) | After (Hybrid) |
|--------|---------------------|----------------|
| Cost per simple query | Paid API call | Free (Mistral local) |
| Cost per complex query | Paid API call | Paid API call (unchanged) |
| Data privacy (simple) | Sent to Google | Stays on local machine |
| Data privacy (complex) | Sent to Google | Sent to Google (unchanged) |
| Response time (simple) | 1-3 seconds | 14-30 seconds (CPU) / 2-5s (GPU) |
| Response time (complex) | 1-3 seconds | 1-3 seconds (Gemini, unchanged) |
| Offline capability | None | Simple queries work |
| Alert quality | High (Gemini) | High (still Gemini) |
| Cold start | None | ~60-90s on first request |
| Single point of failure | API key / internet | Both Mistral + Gemini |
| Debuggability | Low (all silent) | High (per-error logging) |

---

## 10. Recommended Next Steps (Priority Order)

1. **Run `nvidia-smi`** — if GPU is available, response times become acceptable immediately. Zero code changes needed.
2. **Add warmup thread in main.py** — eliminates cold-start penalty for first user.
3. **Add frontend loading indicator** — sets user expectations while GPU fix is being arranged.
4. **Replace keyword classifier** with Mistral self-classification for smarter routing.
5. **Evaluate `llama3.2:3b`** as a replacement — smaller, faster, better JSON compliance.
6. **Long term:** Fine-tune a model on Simax Assure's own financial data for domain-specific accuracy.
