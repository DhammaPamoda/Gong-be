#!/bin/bash
# Git wrapper function that handles branch-aware git operations
# Usage: git_wrapper <branch_name> <git_command> [git_args...]
#
# Examples:
#   git_wrapper "master" "fetch" "origin"
#   git_wrapper "develop" "pull" "origin"
#   git_wrapper "" "fetch"  # Uses default behavior when branch is empty

git_wrapper() {
  local branch_name=$1
  shift
  local git_command=$1
  shift
  local git_args=("$@")
  
  # If branch is provided and not empty, add it to the command
  if [ -n "${branch_name}" ]; then
    case "${git_command}" in
      fetch|pull)
        # For fetch and pull, add branch after origin/remote
        if [ "${#git_args[@]}" -gt 0 ] && [[ "${git_args[0]}" == origin ]] || [[ "${git_args[0]}" == */* ]]; then
          git "${git_command}" "${git_args[@]}" "${branch_name}"
        else
          git "${git_command}" "${git_args[@]}" "${branch_name}"
        fi
        ;;
      checkout)
        # For checkout, use origin/branch format
        if [ "${#git_args[@]}" -gt 0 ]; then
          # Replace any hardcoded branch references with the provided branch
          local last_arg="${git_args[-1]}"
          if [[ "${last_arg}" == origin/* ]]; then
            git_args[-1]="origin/${branch_name}"
          fi
          git "${git_command}" "${git_args[@]}"
        else
          git "${git_command}" "origin/${branch_name}"
        fi
        ;;
      *)
        # For other commands, just pass through
        git "${git_command}" "${git_args[@]}"
        ;;
    esac
  else
    # No branch specified, use default git behavior
    git "${git_command}" "${git_args[@]}"
  fi
}

# Export the function so it can be sourced by other scripts
export -f git_wrapper

