FROM public.ecr.aws/docker/library/python:3.12-slim

WORKDIR /app

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /usr/local/bin/uv

# Install dependencies first (cache layer)
COPY pyproject.toml .
RUN uv pip install --system .
RUN uv pip install --system aws-opentelemetry-distro

# Copy application code
COPY . .

# Run as non-root user
RUN useradd -r -s /usr/sbin/nologin appuser
USER appuser

# OpenTelemetry instrumented entrypoint
ENTRYPOINT ["opentelemetry-instrument", "python", "-m", "app"]
