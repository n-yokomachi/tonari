---
name: aws-cost
description: Analyze and visualize AWS cost data using get_aws_cost for data retrieval and execute_python for matplotlib chart generation
allowed-tools: get_aws_cost execute_python
---

# AWS Cost Analysis Skill

Two-step process: fetch data with `get_aws_cost`, then visualize with `execute_python`.

## Critical Rules

- **NEVER use boto3 inside execute_python** — the sandbox has no AWS credentials.
- **NEVER call plt.savefig()** — images are auto-captured from open figures.
- **NEVER call plt.close()** — closing figures prevents image capture.
- **Use English for ALL text** in charts (titles, labels, legends) — Japanese fonts are unavailable.
- Just create figures with `plt.subplots()` and leave them open.

## Step 1: Fetch Data

```
get_aws_cost(period="monthly", months=3, group_by_service=True)
```

## Step 2: Visualize

Pass the cost data as a Python literal. Example:

```python
import matplotlib.pyplot as plt

data = ...  # paste get_aws_cost result here

months = [d["start"][:7] for d in data]
totals = [d["total"] for d in data]

fig, ax = plt.subplots(figsize=(10, 5))
bars = ax.bar(months, totals, color='#4A90D9')
ax.set_title('Monthly AWS Cost', fontsize=14, fontweight='bold')
ax.set_ylabel('Cost (USD)')
for bar, cost in zip(bars, totals):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
            f'${cost:.2f}', ha='center', va='bottom', fontsize=9)
plt.tight_layout()
# DO NOT call plt.savefig() or plt.close() — images are auto-captured
```

### Service Breakdown

```python
import matplotlib.pyplot as plt

all_services = {}
for d in data:
    for svc, cost in d.get("services", {}).items():
        all_services[svc] = all_services.get(svc, 0) + cost

sorted_svcs = sorted(all_services.items(), key=lambda x: x[1], reverse=True)[:10]
services = [s[0] for s in sorted_svcs]
costs = [s[1] for s in sorted_svcs]

fig, ax = plt.subplots(figsize=(10, 6))
ax.barh(range(len(services)), costs, color='#4A90D9')
ax.set_yticks(range(len(services)))
ax.set_yticklabels(services, fontsize=8)
ax.set_xlabel('Cost (USD)')
ax.set_title('AWS Cost by Service', fontsize=14, fontweight='bold')
ax.invert_yaxis()
for i, cost in enumerate(costs):
    ax.text(cost + 0.1, i, f'${cost:.2f}', va='center', fontsize=9)
plt.tight_layout()
# DO NOT call plt.savefig() or plt.close()
```
