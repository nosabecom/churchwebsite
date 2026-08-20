#!/usr/bin/env bash

set -euo pipefail

readonly function_name="route-site-deploy"
readonly hook_key="CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL"
readonly project_id="${SANITY_PROJECT_ID:-${SANITY_STUDIO_PROJECT_ID:-qd5xjyx2}}"
readonly dataset="${SANITY_DATASET:-${SANITY_STUDIO_DATASET:-development}}"

show_help() {
    cat <<'EOF'
Configure the Church Main Vercel deploy hook on the Sanity development Function.

Usage:
  pnpm blueprint:configure:churchmain [--yes]

The script prompts for the hook without echoing it. Alternatively, export
CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL before running it. The secret is sent directly
to Sanity and is never written to the repository.

Optional environment variables:
  SANITY_PROJECT_ID              Defaults to the RCCG Cornerstone project.
  SANITY_DATASET                 Must be development.
  SANITY_BLUEPRINT_STACK_ID      Overrides the local Blueprint stack binding.
  CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL
                                 Supplies the hook without an interactive prompt.
EOF
}

assume_yes=false
case "${1:-}" in
    "") ;;
    --yes) assume_yes=true ;;
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
    printf 'This command accepts at most one argument.\n' >&2
    exit 2
fi

if [[ "$dataset" != "development" ]]; then
    printf 'Refusing to configure a non-development dataset: %s\n' "$dataset" >&2
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
stack_label="the local .sanity Blueprint binding"
if [[ -n "${SANITY_BLUEPRINT_STACK_ID:-}" ]]; then
    stack_args=(--stack "$SANITY_BLUEPRINT_STACK_ID")
    stack_label="$SANITY_BLUEPRINT_STACK_ID"
elif [[ ! -f .sanity/blueprint.config.json ]]; then
    printf 'No local Blueprint stack binding was found. Set SANITY_BLUEPRINT_STACK_ID.\n' >&2
    exit 1
fi

hook_url="${CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL:-}"
if [[ -z "$hook_url" ]]; then
    if [[ ! -t 0 ]]; then
        printf '%s is unset and an interactive terminal is required.\n' "$hook_key" >&2
        exit 1
    fi
    read -r -s -p "Church Main Vercel deploy hook URL: " hook_url
    printf '\n'
fi
trap 'unset hook_url' EXIT

if [[ ! "$hook_url" =~ ^https://api\.vercel\.com/v1/integrations/deploy/[^/?]+/[^/?]+(\?.*)?$ ]]; then
    printf 'The supplied value is not a valid Vercel deploy-hook URL.\n' >&2
    exit 1
fi

printf 'Target project: %s\n' "$project_id"
printf 'Target dataset: %s\n' "$dataset"
printf 'Target stack:   %s\n' "$stack_label"
printf 'Function key:   %s\n' "$hook_key"

if [[ "$assume_yes" != true ]]; then
    read -r -p "Install this secret in the development Function? [y/N] " confirmation
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        printf 'No changes were made.\n'
        exit 0
    fi
fi

SANITY_PROJECT_ID="$project_id" \
SANITY_DATASET="$dataset" \
npx --yes sanity@latest functions env add \
    "$function_name" \
    "$hook_key" \
    "$hook_url" \
    "${stack_args[@]}"

printf '\nConfigured Function environment keys (values remain hidden):\n'
SANITY_PROJECT_ID="$project_id" \
SANITY_DATASET="$dataset" \
npx --yes sanity@latest functions env list "$function_name" "${stack_args[@]}"
