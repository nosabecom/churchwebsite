#!/usr/bin/env bash

set -euo pipefail

readonly project_id="${SANITY_PROJECT_ID:-${SANITY_STUDIO_PROJECT_ID:-qd5xjyx2}}"
readonly dataset="${SANITY_DATASET:-${SANITY_STUDIO_DATASET:-development}}"
readonly function_name="route-site-deploy"

show_help() {
    cat <<'EOF'
Watch the deployed newsletter-routing Function in the Sanity development stack.

Usage:
  pnpm blueprint:logs:development

The command supplies the required Blueprint project and dataset automatically.
Set SANITY_BLUEPRINT_STACK_ID only when overriding the local stack binding.
EOF
}

case "${1:-}" in
    "") ;;
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        printf 'Unknown argument: %s\n\n' "$1" >&2
        show_help >&2
        exit 2
        ;;
esac

if [[ $# -gt 1 ]]; then
    printf 'This command does not accept positional arguments.\n' >&2
    exit 2
fi

if [[ "$dataset" != "development" ]]; then
    printf 'Refusing to watch a non-development dataset: %s\n' "$dataset" >&2
    exit 1
fi

if [[ ! "$project_id" =~ ^[a-z0-9]+$ ]]; then
    printf 'SANITY_PROJECT_ID is not a valid project ID.\n' >&2
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    printf 'npx is required but was not found.\n' >&2
    exit 1
fi

if [[ ! -f sanity.blueprint.ts ]]; then
    printf 'Run this command from the repository root.\n' >&2
    exit 1
fi

stack_args=()
if [[ -n "${SANITY_BLUEPRINT_STACK_ID:-}" ]]; then
    stack_args=(--stack "$SANITY_BLUEPRINT_STACK_ID")
elif [[ ! -f .sanity/blueprint.config.json ]]; then
    printf 'No local Blueprint stack binding was found. Set SANITY_BLUEPRINT_STACK_ID.\n' >&2
    exit 1
fi

printf 'Watching %s in %s.%s. Press Ctrl+C to stop.\n' \
    "$function_name" \
    "$project_id" \
    "$dataset"

SANITY_PROJECT_ID="$project_id" \
SANITY_DATASET="$dataset" \
exec npx --yes sanity@latest functions logs \
    "$function_name" \
    "${stack_args[@]}" \
    --watch \
    --utc
