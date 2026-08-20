VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip
RUFF := $(VENV)/bin/ruff

PY_SRC := app agent.py tests

.DEFAULT_GOAL := help
.PHONY: help install check lint fmt test tokens build deploy clean

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

$(VENV):
	python3 -m venv $(VENV)

install: $(VENV) ## Create the venv and install Python + client dependencies
	$(PIP) install --upgrade pip --quiet
	$(PIP) install -r requirements-dev.txt --quiet
	npm --prefix client install --no-audit --no-fund

lint: ## ruff lint + format check + oxlint
	$(RUFF) check $(PY_SRC)
	$(RUFF) format --check $(PY_SRC)
	npm --prefix client run lint

fmt: ## Auto-fix lint violations and format Python in place
	$(RUFF) check --fix $(PY_SRC)
	$(RUFF) format $(PY_SRC)

test: ## Run the pytest suite
	$(PY) -m pytest -q

tokens: ## Fail if the JSX references an undefined CSS custom property
	@bash scripts/check-tokens.sh

build: ## Build the React client
	npm --prefix client run build

check: lint tokens test build ## Everything CI runs -- run this before saying a change is done

deploy: ## Build, rsync to ~/.habitarmour, reload launchd (restarts the live app)
	bash install.sh

clean: ## Remove the venv, build output and caches
	rm -rf $(VENV) client/dist .pytest_cache .ruff_cache
	find . -name __pycache__ -type d -not -path './client/*' -exec rm -rf {} + 2>/dev/null || true
