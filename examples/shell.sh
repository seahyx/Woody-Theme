#!/usr/bin/env bash
#
# shell.sh: nightly sensor-log importer for the fictional Woody Lumber Yard, used to preview the Woody theme's shell highlighting.
# Demonstrates: shebang, set -euo pipefail, readonly constants, functions with local variables, positional and special parameters ($@ $# $? $$), parameter expansion, indexed and associative arrays, [[ ]] tests with =~, case/esac, for and while-read loops, here-doc and here-string, command substitution, arithmetic, pipelines, redirections, trap cleanup, printf formats and getopts.

set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="${0##*/}"
readonly API_URL="https://api.example.org/v1/readings"
readonly MOISTURE_MAX=20
declare -r VERSION="1.4.0"

# Kiln codes mapped to the species they are currently drying.
declare -A KILN_SPECIES=(
  [K1]="Quercus robur"
  [K2]="Pinus sylvestris"
  [K3]="Pseudotsuga menziesii"
)
declare -a FLAGGED=()

verbose=0
dry_run=false
log_dir="${WOODY_LOG_DIR:-/var/log/woody}"
tmp_dir="$(mktemp -d)"

#######################################
# Remove the scratch directory on exit and report the final status.
# Globals: tmp_dir
# Arguments: none
#######################################
cleanup() {
  local status=$?
  rm -rf -- "$tmp_dir"
  (( verbose )) && echo "[$SCRIPT_NAME] exiting with status $status (pid $$)" >&2
  return "$status"
}
trap cleanup EXIT
trap 'echo "interrupted" >&2; exit 130' INT TERM

#######################################
# Print a timestamped log line to stderr.
# Arguments: level, message...
#######################################
log() {
  local level="${1^^}"
  shift
  printf '%s %-5s %s\n' "$(date +%FT%T)" "$level" "$*" >&2
}

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-v] [-n] [-d DIR] FILE...

Import kiln sensor CSV files into the Woody inventory.

Options:
  -d DIR   read logs from DIR (default: $log_dir)
  -n       dry run, do not upload
  -v       verbose output
  -h       show this help

Version $VERSION
EOF
}

#######################################
# Parse one CSV line "kiln,timestamp,temp_c,moisture_pct" and validate it.
# Arguments: the raw line
# Returns: 0 if the reading is valid, 1 otherwise
#######################################
parse_reading() {
  local line="$1"
  local kiln ts temp moisture

  IFS=, read -r kiln ts temp moisture <<< "$line"

  # Timestamps must look like 2026-11-26T03:15:00Z.
  if [[ ! $ts =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})T[0-9:]{8}Z$ ]]; then
    log warn "bad timestamp '$ts' on kiln ${kiln:-?}"
    return 1
  fi
  local month="${BASH_REMATCH[2]}"

  case "$kiln" in
    K[1-3])
      ;;
    K*)
      log warn "unknown kiln $kiln"
      return 1
      ;;
    *)
      return 1
      ;;
  esac

  # Bash arithmetic is integer only, so compare the whole-number part.
  if (( ${moisture%.*} > MOISTURE_MAX )); then
    FLAGGED+=("$kiln@$ts")
  fi

  # 10# forces base ten so months like "08" are not read as invalid octal.
  printf '%-4s kiln=%d %-25s month=%02d temp=%6.1f°C moisture=%5.2f%%\n' "$kiln" "${kiln#K}" "${KILN_SPECIES[$kiln]}" "$((10#$month))" "$temp" "$moisture"
}

import_file() {
  local file="$1"
  local -i count=0 errors=0

  [[ -r $file ]] || { log error "cannot read $file"; return 2; }

  while IFS= read -r line || [[ -n $line ]]; do
    [[ -z $line || $line == \#* ]] && continue
    if parse_reading "$line"; then
      count+=1
    else
      (( errors++ )) || true
    fi
  done < "$file"

  log info "${file##*/}: $count ok, $errors rejected"
  return $(( errors > 0 ? 1 : 0 ))
}

while getopts ":d:nvh" opt; do
  case $opt in
    d) log_dir="${OPTARG%/}" ;;
    n) dry_run=true ;;
    v) (( verbose++ )) || true ;;
    h) usage; exit 0 ;;
    :) log error "option -$OPTARG needs an argument"; exit 64 ;;
    \?) log error "unknown option -$OPTARG"; usage >&2; exit 64 ;;
  esac
done
shift $(( OPTIND - 1 ))

if (( $# == 0 )); then
  # Fall back to every CSV log in the directory, newest first.
  mapfile -t files < <(ls -t "$log_dir"/*.csv 2>/dev/null || true)
else
  files=("$@")
fi

log info "importing ${#files[@]} file(s) from ${log_dir/#$HOME/\~}"

# Redirect rather than pipe the loop, so FLAGGED is filled in this shell and not in a subshell.
for f in "${files[@]}"; do
  import_file "$f" || log warn "import of $f finished with status $?"
done > "$tmp_dir/report.txt"

# Busiest kilns first: count readings per kiln code.
cut -d' ' -f1 "$tmp_dir/report.txt" | sort | uniq -c | sort -rn | head -n 3 >&2

if (( ${#FLAGGED[@]} > 0 )); then
  # "${arr[*]}" joins on the first character of IFS (a newline here), so join with commas in a subshell instead.
  (IFS=,; log warn "moisture above ${MOISTURE_MAX}% in: ${FLAGGED[*]}")
fi

summary="$(wc -l < "$tmp_dir/report.txt")"
summary="${summary// /}"

if [[ $dry_run == true ]]; then
  log info "dry run: would upload $summary readings to $API_URL"
  exit 0
fi

curl --silent --show-error --fail -X POST -H "Content-Type: text/plain" --data-binary @"$tmp_dir/report.txt" "$API_URL" > /dev/null 2>&1 || {
  log error "upload failed"
  exit 1
}

log info "uploaded $summary readings"
