#!/usr/bin/env bash
# Vercel "Ignored Build Step" for this pnpm monorepo.
# Exit 0 => skip the build; exit 1 => run the build.
#
# Set as each project's Settings -> Git -> Ignored Build Step:
#   bash scripts/vercel-ignore.sh apps/app
#   bash scripts/vercel-ignore.sh apps/marketing
#
# Builds when the given app, any shared package, or root dep/config changed.
set -uo pipefail

APP_DIR="${1:?usage: vercel-ignore.sh <app-dir>}"
cd "$(git rev-parse --show-toplevel)" || exit 1

# Vercel provides the previous deploy's SHA; fall back to the parent commit.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

WATCH=("$APP_DIR" packages pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json)

if git diff --quiet "$BASE" HEAD -- "${WATCH[@]}"; then
  echo "No relevant changes for $APP_DIR since $BASE — skipping build."
  exit 0
fi

echo "Relevant changes for $APP_DIR since $BASE — building."
exit 1
