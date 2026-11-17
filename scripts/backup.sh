#!/usr/bin/env bash
set -euo pipefail
umask 077

app_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
# Compose and database transfer commands lock this same directory.
exec 9<"$app_dir"
flock -n 9 || { echo 'Eventroam maintenance is already running.' >&2; exit 1; }

mode=${1:-run}
shift "$(( $# > 0 ? 1 : 0 ))"
case "$mode" in run|verify|restic|resume) ;; *) echo 'Expected run, verify SNAPSHOT DIRECTORY, restic ARGS, or resume.' >&2; exit 1 ;; esac
env_file=$app_dir/.env
compose_file=$app_dir/compose.backup.yaml
# Use the deployed inputs rather than S3 settings from the calling shell.
unset RESTIC_REPOSITORY AWS_DEFAULT_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
job_container=eventroam-backup-job
tmp_dir=$(mktemp -d)
trap 'rm -rf -- "$tmp_dir"' EXIT
running=()
paused=false
restore_mount=()

find_service() {
  local ids
  ids=$(docker ps -aq --filter label=com.docker.compose.project=eventroam --filter "label=com.docker.compose.service=$1" --filter label=com.docker.compose.oneoff=False)
  [[ $ids =~ ^[a-f0-9]{12,64}$ ]] || { echo "Expected one Eventroam $1 container." >&2; return 1; }
  echo "$ids"
}
studio=$(find_service studio)
web=$(find_service web)
image=$(docker inspect -f '{{.Image}}' "$studio")
volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$studio")
[[ $volume == eventroam_data ]] || { echo 'Expected the eventroam_data volume at /data.' >&2; exit 1; }
[[ $(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$web") == "$volume" ]] || { echo 'Web and Studio must share the data volume.' >&2; exit 1; }

job() {
  local inputs=/dev/null args=(run --rm --no-deps -T --name "$job_container")
  if [[ $1 == restic ]]; then inputs=$env_file; fi
  if (( ${#restore_mount[@]} )); then args+=("${restore_mount[@]}"); fi
  EVENTROAM_BACKUP_IMAGE=$image docker compose --env-file "$inputs" -f "$compose_file" -p eventroam-backup \
    "${args[@]}" "$@"
}
application() {
  docker compose --env-file /dev/null -f "$app_dir/compose.yaml" -p eventroam "$@"
}
restart_services() {
  local result=0 service pending=()
  if [[ $paused == true ]]; then
    if job database resume; then paused=false; else result=1; fi
  fi
  if (( ${#running[@]} )); then
    for service in "${running[@]}"; do
      if ! application start --wait --wait-timeout 120 "$service" >/dev/null; then
        pending+=("$service")
        result=1
      fi
    done
  fi
  running=()
  if (( ${#pending[@]} )); then running=("${pending[@]}"); fi
  return "$result"
}
finish() {
  local result=$?
  trap - EXIT
  # Stop a surviving backup worker before opening the application files again.
  docker rm -f "$job_container" >/dev/null 2>&1 || true
  restart_services || { result=1; restart_services || true; }
  rm -rf -- "$tmp_dir"
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ $mode == resume ]]; then
  job database resume
  echo 'Studio backup pause cleared. Start any stopped services through Komodo.'
  exit 0
fi

if [[ $mode == restic ]]; then
  job restic "$@"
  exit 0
fi
job restic cat config >/dev/null

if [[ $mode == verify ]]; then
  [[ $# == 2 && $1 =~ ^[a-f0-9]{8,64}$ && $2 == /* && -d $2 && -z $(ls -A -- "$2") ]] || { echo 'Expected a snapshot ID and an empty absolute restore directory.' >&2; exit 1; }
  snapshot=$1
  target=$2
  job restic stats "$snapshot" --mode restore-size --json >"$tmp_dir/stats.json"
  restore_bytes=$(sed -nE 's/.*"total_size"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$tmp_dir/stats.json")
  available_kb=$(df -Pk -- "$target" | awk 'NR==2 {print $4}')
  [[ $restore_bytes =~ ^[0-9]+$ && $available_kb =~ ^[0-9]+$ ]] || { echo 'Cannot check restore disk space.' >&2; exit 1; }
  (( available_kb * 1024 > restore_bytes + 1024 * 1024 * 1024 )) || { echo 'Restore needs space for the full snapshot plus 1 GiB. Use another disk.' >&2; exit 1; }
  restore_mount=(-v "$target:/restore")
  job restic restore "$snapshot" --target /restore --verify
  job database verify
  echo "Restore verified in $target. Keep or remove this isolated copy as needed."
  exit 0
fi

# Record the original state before the first pause or stop.
for service in web studio; do
  if [[ $(docker inspect -f '{{.State.Running}}' "${!service}") == true ]]; then running+=("$service"); fi
done
paused=true
job database pause
if [[ $(docker inspect -f '{{.State.Running}}' "$studio") == true ]]; then
  docker exec "$studio" node commands/backup.mjs drain
fi
if (( ${#running[@]} )); then application stop -t 120 "${running[@]}" >/dev/null; fi
job database prepare
# The prepared catalog file is stable. Read-only website requests can resume.
if (( ${#running[@]} )); then
  for service in "${running[@]}"; do
    if [[ $service == web ]]; then application start --wait --wait-timeout 120 web >/dev/null; fi
  done
fi
job restic backup --host eventroam --tag eventroam --tag "image=$image" --compression auto \
  /data/eventroam.sqlite /data/mastra-workflows.sqlite /data/mastra-chat.sqlite \
  /data/mastra-evals.sqlite /data/mastra-observability.duckdb /data/ingestion-sources
job database prune
restart_services
# Keep daily snapshots for six calendar months. Never expire S3 objects by age.
job restic forget --host eventroam --tag eventroam --group-by host --keep-within 6m --prune
job restic check
echo 'Eventroam backup and retention completed.'
